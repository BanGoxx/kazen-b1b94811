import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Newspaper } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";

/**
 * KAZEN article / news detail foundation.
 *
 * This route establishes the URL pattern and premium French-first layout for
 * title-scoped editorial content so it can be wired to a real source later
 * without redesigning the fiche. Until a safe, title-scoped news source is
 * connected, no article exists, so every slug resolves to a graceful
 * not-found instead of fabricated content.
 */
export const Route = createFileRoute("/actualites/$slug")({
  loader: async () => {
    // No editorial source is wired yet — never fabricate an article.
    throw notFound();
  },
  head: () => ({
    meta: [
      { title: "Actualité — KAZEN" },
      { name: "description", content: "Actualités autour des anime, séries et films sur KAZEN." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => null,
  notFoundComponent: ArticleNotFound,
});

function ArticleNotFound() {
  return (
    <AppShell>
      <div className="mx-auto max-w-lg py-24 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card/60">
          <Newspaper className="h-6 w-6 text-primary" />
        </div>
        <h1 className="font-display text-2xl font-bold">Article indisponible</h1>
        <p className="mt-2 text-muted-foreground">
          Cette actualité n'est pas encore disponible sur KAZEN.
        </p>
        <Button asChild className="mt-6">
          <Link to="/">
            <ArrowLeft className="mr-1 h-4 w-4" /> Retour à la découverte
          </Link>
        </Button>
      </div>
    </AppShell>
  );
}
