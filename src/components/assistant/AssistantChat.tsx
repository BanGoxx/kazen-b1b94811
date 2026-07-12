import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import { MessageCircle, X, Send, Loader2, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getAssistantHistory, clearAssistantHistory } from "@/lib/assistant-chat.functions";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Un anime d'action récent bien noté",
  "Une série thriller à binge-watcher",
  "Explique-moi l'univers de Fate",
  "Un film d'animation à voir ce soir",
];

function toUIMessages(rows: { id: string; role: "user" | "assistant"; content: string }[]): UIMessage[] {
  return rows.map((r) => ({
    id: r.id,
    role: r.role,
    parts: [{ type: "text", text: r.content }],
  })) as UIMessage[];
}

function textOf(m: UIMessage): string {
  return m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
}

export function AssistantChat() {
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Track auth so we can persist + attach a bearer token.
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSignedIn(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Load the single persisted conversation once, when opened while signed in.
  useEffect(() => {
    if (!open || historyLoaded || !signedIn) return;
    let active = true;
    getAssistantHistory()
      .then((rows) => {
        if (active) setInitialMessages(toUIMessages(rows));
      })
      .catch(() => {})
      .finally(() => {
        if (active) setHistoryLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [open, historyLoaded, signedIn]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: async () => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      }),
    [],
  );

  const { messages, sendMessage, status, setMessages } = useChat({
    id: "kazen-assistant",
    messages: initialMessages,
    transport,
  });

  // Prime the chat with loaded history once available.
  useEffect(() => {
    if (historyLoaded && initialMessages.length && messages.length === 0) {
      setMessages(initialMessages);
    }
  }, [historyLoaded, initialMessages, messages.length, setMessages]);

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  function send(text: string) {
    const t = text.trim();
    if (!t || isLoading) return;
    sendMessage({ text: t });
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 30);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  async function onClear() {
    setMessages([]);
    setInitialMessages([]);
    if (signedIn) await clearAssistantHistory().catch(() => {});
  }

  return (
    <>
      {/* Floating trigger */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ouvrir l'assistant KAZEN"
          className="focus-ring fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow transition-transform hover:scale-105 active:scale-95 sm:bottom-6 sm:right-6"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Assistant KAZEN"
          className="fixed inset-x-3 bottom-3 z-50 flex h-[75vh] max-h-[640px] flex-col overflow-hidden rounded-3xl border border-border bg-card/95 shadow-2xl backdrop-blur-xl sm:inset-x-auto sm:right-6 sm:bottom-6 sm:h-[600px] sm:w-[420px]"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-border bg-card/80 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold leading-none text-foreground">Assistant KAZEN</p>
                <p className="mt-0.5 text-[0.7rem] text-muted-foreground">Ton copilote anime, séries & films</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={onClear}
                  aria-label="Effacer la conversation"
                  className="focus-ring rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer l'assistant"
                className="focus-ring rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Dis-moi une envie et je te propose quoi regarder. Par exemple&nbsp;:
                </p>
                <div className="flex flex-col gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="focus-ring hover-lift rounded-xl border border-border bg-background/60 px-3 py-2 text-left text-sm font-medium text-foreground transition hover:border-primary/40"
                    >
                      {s}
                    </button>
                  ))}
                </div>
                {!signedIn && (
                  <p className="text-[0.72rem] text-muted-foreground">
                    Connecte-toi pour retrouver ta conversation sur tous tes appareils.
                  </p>
                )}
              </div>
            ) : (
              messages.map((m) => {
                const text = textOf(m);
                if (m.role === "user") {
                  return (
                    <div key={m.id} className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2.5 text-sm text-primary-foreground">
                        {text}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={m.id} className="flex justify-start">
                    <div className="prose-assistant max-w-[90%] text-sm leading-relaxed text-foreground">
                      <ReactMarkdown>{text}</ReactMarkdown>
                    </div>
                  </div>
                );
              })
            )}
            {status === "submitted" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Réflexion…
              </div>
            )}
          </div>

          {/* Composer */}
          <form onSubmit={onSubmit} className="border-t border-border bg-card/80 p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                placeholder="Écris ton envie…"
                aria-label="Message pour l'assistant"
                className="focus-ring max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                aria-label="Envoyer"
                className={cn(
                  "focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-opacity",
                  (!input.trim() || isLoading) && "opacity-50",
                )}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
