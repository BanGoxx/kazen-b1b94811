import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

type ChatRequestBody = { messages?: unknown };

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

async function persist(
  token: string,
  userText: string | null,
  assistantText: string,
) {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return;
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return;
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
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const token = bearerFrom(request);
        const uiMessages = messages as UIMessage[];

        // Extract the latest user message text for persistence.
        const lastUser = [...uiMessages].reverse().find((m) => m.role === "user");
        const lastUserText = lastUser
          ? lastUser.parts
              .map((p) => (p.type === "text" ? p.text : ""))
              .join("")
              .trim() || null
          : null;

        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway("google/gemini-3-flash-preview"),
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(uiMessages),
          onFinish: async ({ text }) => {
            if (token) await persist(token, lastUserText, text);
          },
        });

        return result.toUIMessageStreamResponse({ originalMessages: uiMessages });
      },
    },
  },
});
