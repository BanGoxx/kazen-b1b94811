import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

type ChatRequestBody = { messages?: unknown };

// --- Abuse / cost guardrails ------------------------------------------------
const MAX_MESSAGES = 40; // reject obviously oversized histories
const MODEL_HISTORY_TURNS = 12; // only the most recent turns are sent to the model
const MAX_USER_CHARS = 2000; // per-message input cap
const MAX_OUTPUT_TOKENS = 800; // bound provider output cost

const SYSTEM_PROMPT = `Tu es l'assistant de KAZEN, une application française premium de découverte et de suivi d'anime, séries et films.
Ton rôle : aider l'utilisateur à trouver quoi regarder, comparer des titres, expliquer un univers, organiser ses envies.
Règles :
- Réponds toujours en français, ton chaleureux, précis et concis.
- Quand tu recommandes des titres, donne une courte liste (3 à 6) avec une phrase d'accroche par titre.
- Utilise le markdown (listes, gras) pour la lisibilité.
- Reste dans le domaine anime / séries / films et l'usage de KAZEN. Si on te demande autre chose, recentre poliment.
- N'invente pas de fonctionnalités KAZEN qui n'existent pas.`;

function bearerFrom(request: Request): string | null {
  const h = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function textOf(m: UIMessage): string {
  return m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
}

async function requestKey(text: string): Promise<string> {
  try {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .slice(0, 16)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return String(text.length);
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const DENY_MESSAGES: Record<string, string> = {
  disabled: "L'assistant est momentanément indisponible. Réessaie un peu plus tard.",
  global: "L'assistant reçoit beaucoup de demandes en ce moment. Réessaie dans quelques minutes.",
  daily: "Tu as atteint ta limite de questions pour aujourd'hui. Reviens demain !",
  monthly: "Tu as atteint ta limite de questions pour ce mois-ci.",
  new_account: "Ton compte est récent : la limite de questions est temporairement réduite. Réessaie plus tard.",
  auth: "Connecte-toi pour utiliser l'assistant KAZEN.",
};

async function persist(
  supabase: SupabaseClient,
  userId: string,
  userText: string | null,
  assistantText: string,
) {
  try {
    const rows: { user_id: string; role: string; content: string }[] = [];
    if (userText) rows.push({ user_id: userId, role: "user", content: userText });
    if (assistantText) rows.push({ user_id: userId, role: "assistant", content: assistantText });
    if (rows.length) await supabase.from("assistant_messages").insert(rows);
  } catch (err) {
    console.error("assistant persist failed", err);
  }
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(messages) || messages.length === 0) {
          return json({ error: "Messages are required" }, 400);
        }
        if (messages.length > MAX_MESSAGES) {
          return json({ error: "Conversation trop longue." }, 400);
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return json({ error: "Missing LOVABLE_API_KEY" }, 500);

        // --- Require an authenticated member -------------------------------
        const token = bearerFrom(request);
        if (!token) {
          return json({ error: DENY_MESSAGES.auth, reason: "auth" }, 401);
        }
        const url = process.env.SUPABASE_URL;
        const pubKey = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!url || !pubKey) return json({ error: "Server misconfigured" }, 500);

        const supabase = createClient(url, pubKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) {
          return json({ error: DENY_MESSAGES.auth, reason: "auth" }, 401);
        }

        const uiMessages = messages as UIMessage[];

        // --- Validate the latest user message -----------------------------
        const lastUser = [...uiMessages].reverse().find((m) => m.role === "user");
        const lastUserText = lastUser ? textOf(lastUser).trim() : "";
        if (!lastUserText) {
          return json({ error: "Message vide." }, 400);
        }
        if (lastUserText.length > MAX_USER_CHARS) {
          return json({ error: "Ton message est trop long." }, 400);
        }

        // --- Quota reservation (server-enforced) --------------------------
        const rk = await requestKey(lastUserText);
        const { data: reserve, error: reserveError } = await supabase.rpc(
          "ai_assistant_reserve",
          { _request_key: rk },
        );
        if (reserveError) {
          console.error("ai_assistant_reserve failed", reserveError);
          return json({ error: "Assistant indisponible." }, 500);
        }
        const decision = (reserve ?? {}) as {
          allowed?: boolean;
          reason?: string;
          usage_id?: string;
        };
        if (!decision.allowed) {
          const reason = decision.reason ?? "daily";
          const status = reason === "disabled" || reason === "auth" ? 403 : 429;
          return json(
            { error: DENY_MESSAGES[reason] ?? DENY_MESSAGES.daily, reason },
            status,
          );
        }
        const usageId = decision.usage_id;

        async function finalize(
          statusValue: "success" | "failed",
          inputTokens?: number,
          outputTokens?: number,
          errorCode?: string,
        ) {
          if (!usageId) return;
          try {
            await supabase.rpc("ai_assistant_finalize", {
              _usage_id: usageId,
              _status: statusValue,
              _input_tokens: inputTokens ?? null,
              _output_tokens: outputTokens ?? null,
              _error_code: errorCode ?? null,
            });
          } catch (err) {
            console.error("ai_assistant_finalize failed", err);
          }
        }

        // --- Only send the most recent turns to the model -----------------
        const trimmed = uiMessages.slice(-MODEL_HISTORY_TURNS);

        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway("google/gemini-3-flash-preview"),
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(trimmed),
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          onFinish: async ({ text, usage }) => {
            await finalize(
              "success",
              usage?.inputTokens,
              usage?.outputTokens,
            );
            await persist(supabase, userId, lastUserText, text);
          },
          onError: async (event) => {
            console.error("assistant stream error", event);
            await finalize("failed", undefined, undefined, "stream_error");
          },
        });

        return result.toUIMessageStreamResponse({ originalMessages: uiMessages });
      },
    },
  },
});
