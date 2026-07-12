import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ListMusic,
  Plus,
  Trash2,
  Globe,
  Lock,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useMyPlaylists, usePlaylistMutations } from "@/lib/playlists";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/mes-playlists")({
  head: () => ({
    meta: [
      { title: "Mes playlists — KAZEN" },
      {
        name: "description",
        content: "Créez et partagez vos playlists d'anime, séries et films sur KAZEN.",
      },
    ],
  }),
  component: MyPlaylistsPage,
});

function MyPlaylistsPage() {
  const { data: playlists = [], isLoading } = useMyPlaylists();
  const { create, update, remove } = usePlaylistMutations();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Donnez un titre à votre playlist.");
      return;
    }
    try {
      await create.mutateAsync({ title, description, isPublic });
      setTitle("");
      setDescription("");
      setIsPublic(true);
      toast.success("Playlist créée.");
    } catch {
      toast.error("Impossible de créer la playlist.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Supprimer cette playlist ?")) return;
    try {
      await remove.mutateAsync(id);
      toast.success("Playlist supprimée.");
    } catch {
      toast.error("Impossible de supprimer.");
    }
  };

  const copyLink = (id: string) => {
    const url = `${window.location.origin}/playlist/${id}`;
    navigator.clipboard?.writeText(url);
    toast.success("Lien de partage copié.");
  };

  return (
    <AppShell title="Mes playlists">
      <div className="mx-auto max-w-4xl space-y-8 pb-16">
        <header className="space-y-2">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <ListMusic className="h-6 w-6 text-primary" /> Mes playlists
          </h1>
          <p className="text-sm text-muted-foreground">
            Regroupez vos titres favoris en collections et partagez-les publiquement.
          </p>
        </header>

        {/* Create */}
        <section className="rounded-2xl border border-border bg-card/60 p-5 backdrop-blur">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Nouvelle playlist</h2>
          <div className="space-y-3">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre (ex. Shonen incontournables)"
            />
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optionnelle)"
              rows={2}
              className="resize-y"
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                {isPublic ? "Publique (partageable)" : "Privée"}
              </label>
              <Button variant="aurora" onClick={handleCreate} disabled={create.isPending}>
                <Plus className="mr-1 h-4 w-4" /> Créer
              </Button>
            </div>
          </div>
        </section>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : playlists.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Vous n'avez pas encore de playlist. Créez-en une ci-dessus, ou ajoutez des titres
            depuis leur fiche.
          </p>
        ) : (
          <div className="space-y-3">
            {playlists.map((pl) => (
              <article
                key={pl.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/40 p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      to="/playlist/$id"
                      params={{ id: pl.id }}
                      className="truncate text-base font-semibold text-foreground hover:text-primary"
                    >
                      {pl.title}
                    </Link>
                    {pl.isPublic ? (
                      <Globe className="h-3.5 w-3.5 text-primary" aria-label="Publique" />
                    ) : (
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-label="Privée" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {pl.count} titre{pl.count > 1 ? "s" : ""}
                    {pl.description ? ` · ${pl.description}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      update.mutate({ id: pl.id, isPublic: !pl.isPublic })
                    }
                  >
                    {pl.isPublic ? "Rendre privée" : "Rendre publique"}
                  </Button>
                  {pl.isPublic && (
                    <Button variant="ghost" size="sm" onClick={() => copyLink(pl.id)}>
                      <ExternalLink className="mr-1 h-3.5 w-3.5" /> Partager
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(pl.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
