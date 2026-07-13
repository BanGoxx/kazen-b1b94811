import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { processUnsubscribe } from "@/lib/unsubscribe.functions";

// KAZEN public unsubscribe landing — Phase 2.
// SSR is disabled: the token lives in the URL and the action runs once on the
// client. No session required; the encrypted token authorizes the change.
export const Route = createFileRoute("/desabonnement")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Se désabonner — KAZEN" },
      { name: "robots", content: "noindex,nofollow" },
      {
        name: "description",
        content: "Gérez votre abonnement aux digests KAZEN.",
      },
    ],
  }),
  component: UnsubscribePage,
});

type State =
  | { kind: "loading" }
  | { kind: "done"; scope: "general" | "personalized" | "all" }
  | { kind: "invalid" }
  | { kind: "error" }
  | { kind: "missing" };

const SCOPE_LABEL: Record<string, string> = {
  general: "digest général (nouveautés & actualités)",
  personalized: "digest personnalisé (recommandations)",
  all: "tous les emails de digest",
};

function UnsubscribePage() {
  const run = useServerFn(processUnsubscribe);
  const [state, setState] = useState<State>({ kind: "loading" });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setState({ kind: "missing" });
      return;
    }
    run({ data: { token } })
      .then((res) => {
        if (res.ok) setState({ kind: "done", scope: res.scope });
        else setState({ kind: res.reason === "invalid" ? "invalid" : "error" });
      })
      .catch(() => setState({ kind: "error" }));
  }, [run]);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-6 text-2xl font-black tracking-widest text-primary">KAZEN</div>
      <div className="card-elevated w-full rounded-2xl p-8">
        {state.kind === "loading" && (
          <p className="text-muted-foreground">Traitement de votre demande…</p>
        )}
        {state.kind === "done" && (
          <>
            <h1 className="mb-3 font-display text-xl font-bold">Désabonnement confirmé</h1>
            <p className="text-sm text-muted-foreground">
              Vous ne recevrez plus le {SCOPE_LABEL[state.scope]}. Vous pouvez
              réactiver vos préférences à tout moment depuis votre profil.
            </p>
          </>
        )}
        {state.kind === "missing" && (
          <>
            <h1 className="mb-3 font-display text-xl font-bold">Lien incomplet</h1>
            <p className="text-sm text-muted-foreground">
              Ce lien de désabonnement est incomplet. Ouvrez-le directement
              depuis l'email reçu, ou gérez vos préférences depuis votre profil.
            </p>
          </>
        )}
        {state.kind === "invalid" && (
          <>
            <h1 className="mb-3 font-display text-xl font-bold">Lien invalide ou expiré</h1>
            <p className="text-sm text-muted-foreground">
              Ce lien n'est plus valide. Vous pouvez gérer vos préférences
              d'email directement depuis votre profil KAZEN.
            </p>
          </>
        )}
        {state.kind === "error" && (
          <>
            <h1 className="mb-3 font-display text-xl font-bold">Une erreur est survenue</h1>
            <p className="text-sm text-muted-foreground">
              Impossible de traiter la demande pour le moment. Réessayez plus
              tard ou gérez vos préférences depuis votre profil.
            </p>
          </>
        )}
        <a
          href="/profil"
          className="mt-6 inline-flex rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Gérer mes préférences
        </a>
      </div>
    </main>
  );
}
