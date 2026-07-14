import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  type UIMessage,
} from "ai";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import {
  ASSISTANT_MODEL_ID,
  ASSISTANT_PROMPT_VERSION,
  cacheKeyMaterial,
  evaluateEligibility,
  sha256Hex,
} from "@/lib/assistant-cache";

type ChatRequestBody = { messages?: unknown };

// --- Abuse / cost guardrails ------------------------------------------------
const MAX_MESSAGES = 40; // reject obviously oversized histories
const MODEL_HISTORY_TURNS = 12; // only the most recent turns are sent to the model
const MAX_USER_CHARS = 2000; // per-message input cap
const MAX_OUTPUT_TOKENS = 800; // bound provider output cost

// --- Cache / dedup tuning ---------------------------------------------------
const CACHE_LOCK_SECONDS = 30; // max lifetime of a pending generation lock
const INFLIGHT_POLL_TRIES = 16; // ~8s bounded wait for an in-flight generation
const INFLIGHT_POLL_MS = 500;

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
    const hex = await sha256Hex(text);
    return hex.slice(0, 32);
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
  cache_rate: "Trop de requêtes en peu de temps. Réessaie dans un instant.",
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

/** Stream a stored cached answer through the normal UI message stream. */
function streamCached(text: string, originalMessages: UIMessage[]): Response {
  const stream = createUIMessageStream({
    originalMessages,
    execute: ({ writer }) => {
      const id = crypto.randomUUID();
      writer.write({ type: "text-start", id });
      writer.write({ type: "text-delta", id, delta: text });
      writer.write({ type: "text-end", id });
    },
  });
  return createUIMessageStreamResponse({ stream });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

        // --- Trusted server-only client for cache operations --------------
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Cache settings (server-read; never trust the client for these).
        let cacheEnabled = false;
        let cacheTtl = 180;
        let catalogueVersion = 1;
        try {
          const { data: settings } = await supabaseAdmin
            .from("ai_assistant_settings")
            .select("cache_enabled, cache_ttl_minutes, catalogue_version")
            .eq("id", 1)
            .maybeSingle();
          if (settings) {
            cacheEnabled = !!settings.cache_enabled;
            cacheTtl = settings.cache_ttl_minutes ?? 180;
            catalogueVersion = settings.catalogue_version ?? 1;
          }
        } catch (err) {
          console.error("assistant cache settings read failed", err);
        }

        const eligibility = evaluateEligibility(uiMessages);
        const rk = await requestKey(eligibility.normalized || lastUserText);

        // ---- Helper: serve a cache hit (rate-limited, no paid call) ------
        async function serveCacheHit(responseText: string): Promise<Response> {
          const { data: res, error } = await supabaseAdmin.rpc("ai_assistant_cache_reserve", {
            _user_id: userId,
            _request_key: rk,
          });
          const decision = (res ?? {}) as { allowed?: boolean; reason?: string };
          if (error || !decision.allowed) {
            const reason = decision.reason ?? "cache_rate";
            const status = reason === "disabled" ? 403 : 429;
            return json({ error: DENY_MESSAGES[reason] ?? DENY_MESSAGES.cache_rate, reason }, status);
          }
          // Keep the persisted conversation consistent with the paid path.
          await persist(supabase, userId!, lastUserText, responseText);
          return streamCached(responseText, uiMessages);
        }

        // ---- Cache lookup + in-flight dedup (eligible requests only) -----
        let holdsLock = false;
        let cacheKey: string | null = null;

        if (cacheEnabled && eligibility.eligible) {
          try {
            cacheKey = await sha256Hex(
              cacheKeyMaterial({ normalized: eligibility.normalized, catalogueVersion }),
            );
            const { data: tryRes, error: tryErr } = await supabaseAdmin.rpc("ai_assistant_cache_try", {
              _cache_key: cacheKey,
              _model_id: ASSISTANT_MODEL_ID,
              _prompt_version: ASSISTANT_PROMPT_VERSION,
              _catalogue_version: catalogueVersion,
              _ttl_minutes: cacheTtl,
              _lock_seconds: CACHE_LOCK_SECONDS,
            });
            if (tryErr) throw tryErr;
            const state = (tryRes ?? {}) as { state?: string; response_text?: string };

            if (state.state === "hit" && state.response_text) {
              return await serveCacheHit(state.response_text);
            }
            if (state.state === "acquired") {
              holdsLock = true;
            } else if (state.state === "inflight") {
              // Bounded wait for the concurrent generation to complete.
              for (let i = 0; i < INFLIGHT_POLL_TRIES; i++) {
                await sleep(INFLIGHT_POLL_MS);
                const { data: pollRes } = await supabaseAdmin.rpc("ai_assistant_cache_poll", {
                  _cache_key: cacheKey,
                  _model_id: ASSISTANT_MODEL_ID,
                  _prompt_version: ASSISTANT_PROMPT_VERSION,
                  _catalogue_version: catalogueVersion,
                });
                const pState = (pollRes ?? {}) as { state?: string; response_text?: string };
                if (pState.state === "hit" && pState.response_text) {
                  return await serveCacheHit(pState.response_text);
                }
              }
              // Timed out: fall through to a normal paid call without a lock
              // (do not clobber the other generation's entry).
              cacheKey = null;
            }
          } catch (err) {
            console.error("assistant cache lookup failed", err);
            cacheKey = null;
            holdsLock = false;
          }
        }

        // ---- Paid model path (quota-reserved) ----------------------------
        const { data: reserve, error: reserveError } = await supabase.rpc(
          "ai_assistant_reserve",
          { _request_key: rk },
        );
        if (reserveError) {
          console.error("ai_assistant_reserve failed", reserveError);
          if (holdsLock && cacheKey) {
            await supabaseAdmin.rpc("ai_assistant_cache_release", { _cache_key: cacheKey });
          }
          return json({ error: "Assistant indisponible." }, 500);
        }
        const decision = (reserve ?? {}) as {
          allowed?: boolean;
          reason?: string;
          usage_id?: string;
        };
        if (!decision.allowed) {
          // Release our lock so the next eligible request can generate.
          if (holdsLock && cacheKey) {
            await supabaseAdmin.rpc("ai_assistant_cache_release", { _cache_key: cacheKey });
            holdsLock = false;
          }
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
          model: gateway(ASSISTANT_MODEL_ID),
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(trimmed),
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          onFinish: async ({ text, usage }) => {
            await finalize("success", usage?.inputTokens, usage?.outputTokens);
            await persist(supabase, userId!, lastUserText, text);
            // Store only complete, non-empty answers, and only if we own the lock.
            if (holdsLock && cacheKey && text && text.trim().length > 0) {
              try {
                await supabaseAdmin.rpc("ai_assistant_cache_store", {
                  _cache_key: cacheKey,
                  _response_text: text,
                  _ttl_minutes: cacheTtl,
                });
              } catch (err) {
                console.error("assistant cache store failed", err);
                await supabaseAdmin.rpc("ai_assistant_cache_release", { _cache_key: cacheKey });
              }
            }
          },
          onError: async (event) => {
            console.error("assistant stream error", event);
            await finalize("failed", undefined, undefined, "stream_error");
            // Release the lock so a partial/aborted generation is not cached.
            if (holdsLock && cacheKey) {
              await supabaseAdmin.rpc("ai_assistant_cache_release", { _cache_key: cacheKey });
            }
          },
        });

        return result.toUIMessageStreamResponse({ originalMessages: uiMessages });
      },
    },
  },
});
