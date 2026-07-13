import { useMemo, useState } from "react";
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
  Pencil,
  Settings2,
  Quote,
  CheckCircle2,
  X,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import {
  useMyPlaylists,
  usePlaylist,
  usePlaylistMutations,
  type PlaylistMeta,
} from "@/lib/playlists";
import { useSharedWithMe } from "@/lib/playlist-collab";
import { MediaSearchPicker } from "@/components/media/MediaSearchPicker";
import { SafeImage } from "@/components/media/SafeImage";
import { MEDIA_TYPE_LABELS, type MediaItem } from "@/lib/media-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/mes-playlists")({
  head: () => ({
    meta: [
      { title: "Mes collections — KAZEN" },
      {
        name: "description",
        content:
          "Créez et partagez vos collections éditoriales d'anime, séries et films sur KAZEN.",
      },
    ],
  }),
  component: MyPlaylistsPage,
});

function SharedWithMeSection() {
  const { data: shared = [], isLoading } = useSharedWithMe();
  if (isLoading || shared.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <ListMusic className="h-4 w-4 text-primary" /> Partagées avec moi
      </h2>
      <div className="space-y-3">
        {shared.map((s) => (
          <Link
            key={s.id}
            to="/playlist/$id"
            params={{ id: s.id }}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/40 p-4 transition-colors hover:border-primary/50"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{s.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                par {s.ownerName} · {s.count} titre{s.count > 1 ? "s" : ""}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[0.62rem] font-bold uppercase text-primary">
              {s.role === "editor" ? (
                <>
                  <Pencil className="h-3 w-3" /> Éditeur
                </>
              ) : (
                <>Lecteur</>
              )}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}



const TITLE_MAX = 120;
const INTRO_MAX = 400;
const RECO_MAX = 600;

function MyPlaylistsPage() {
  const { data: playlists = [], isLoading } = useMyPlaylists();
  const { create, update, remove } = usePlaylistMutations();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<string | null>(null);

  const [editing, setEditing] = useState<PlaylistMeta | null>(null);
  const [managing, setManaging] = useState<{ id: string; title: string } | null>(null);

  const handleCreate = async () => {
    const t = title.trim();
    if (!t) {
      setError("Donnez un titre à votre collection.");
      return;
    }
    if (t.length > TITLE_MAX) {
      setError(`Le titre doit faire moins de ${TITLE_MAX} caractères.`);
      return;
    }
    setError(null);
    try {
      const id = await create.mutateAsync({ title: t, description, recommendation, isPublic });
      setTitle("");
      setDescription("");
      setRecommendation("");
      setIsPublic(true);
      setJustCreated(id);
      toast.success("Collection créée.");
    } catch {
      setError("Impossible de créer la collection. Réessayez.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Supprimer cette collection ? Cette action est définitive.")) return;
    try {
      await remove.mutateAsync(id);
      toast.success("Collection supprimée.");
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
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-8 pb-16">
        <header className="space-y-2">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <ListMusic className="h-6 w-6 text-primary" /> Mes collections
          </h1>
          <p className="text-sm text-muted-foreground">
            Composez des sélections éditoriales d'anime, séries et films, et partagez-les avec la
            communauté KAZEN.
          </p>
        </header>

        {/* Create */}
        <section className="rounded-2xl border border-border bg-card/60 p-5 backdrop-blur">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Nouvelle collection</h2>
          <div className="space-y-3">
            <div>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titre (ex. Shonen incontournables)"
                maxLength={TITLE_MAX}
                aria-invalid={Boolean(error)}
              />
            </div>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Introduction courte : de quoi parle cette sélection ? (optionnel)"
              rows={2}
              maxLength={INTRO_MAX}
              className="resize-y"
            />
            <Textarea
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              placeholder="Pourquoi je recommande cette liste (optionnel) — ce texte est mis en avant sur la page publique."
              rows={2}
              maxLength={RECO_MAX}
              className="resize-y"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                {isPublic ? (
                  <span className="inline-flex items-center gap-1">
                    <Globe className="h-3.5 w-3.5 text-primary" /> Publique — visible dans la
                    Découverte communautaire
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <Lock className="h-3.5 w-3.5" /> Privée — visible seulement par vous
                  </span>
                )}
              </label>
              <Button
                variant="aurora"
                size="sm"
                onClick={handleCreate}
                disabled={create.isPending || !title.trim()}
                className="gap-1"
              >
                {create.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Créer
              </Button>
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            {justCreated && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span className="text-foreground">Collection créée !</span>
                <Button
                  variant="aurora"
                  size="sm"
                  className="gap-1"
                  onClick={() => {
                    const id = justCreated;
                    const pl = playlists.find((p) => p.id === id);
                    setManaging({ id, title: pl?.title ?? "Collection" });
                  }}
                >
                  <Plus className="h-3.5 w-3.5" /> Ajouter des titres
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setJustCreated(null)}>
                  Fermer
                </Button>
              </div>
            )}
          </div>
        </section>

        <SharedWithMeSection />

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : playlists.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Vous n'avez pas encore de collection. Créez-en une ci-dessus, ou ajoutez des titres
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
                <div className="flex flex-wrap items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1"
                    onClick={() => setManaging({ id: pl.id, title: pl.title })}
                  >
                    <Settings2 className="h-3.5 w-3.5" /> Titres
                  </Button>
                  <Button variant="ghost" size="sm" className="gap-1" onClick={() => setEditing(pl)}>
                    <Pencil className="h-3.5 w-3.5" /> Modifier
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

      {editing && (
        <EditPlaylistDialog
          playlist={editing}
          onClose={() => setEditing(null)}
          onSave={async (patch) => {
            await update.mutateAsync({ id: editing.id, ...patch });
            toast.success("Collection mise à jour.");
            setEditing(null);
          }}
          saving={update.isPending}
        />
      )}

      {managing && (
        <ManagePlaylistDialog
          playlistId={managing.id}
          title={managing.title}
          onClose={() => setManaging(null)}
        />
      )}
    </AppShell>
  );
}

function EditPlaylistDialog({
  playlist,
  onClose,
  onSave,
  saving,
}: {
  playlist: PlaylistMeta;
  onClose: () => void;
  onSave: (patch: {
    title: string;
    description: string;
    recommendation: string;
    isPublic: boolean;
  }) => Promise<void>;
  saving: boolean;
}) {
  const [title, setTitle] = useState(playlist.title);
  const [description, setDescription] = useState(playlist.description);
  const [recommendation, setRecommendation] = useState(playlist.recommendation);
  const [isPublic, setIsPublic] = useState(playlist.isPublic);
  const [err, setErr] = useState<string | null>(null);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier la collection</DialogTitle>
          <DialogDescription>
            Peaufinez le titre, l'introduction et votre recommandation.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre"
            maxLength={TITLE_MAX}
          />
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Introduction courte (optionnelle)"
            rows={2}
            maxLength={INTRO_MAX}
            className="resize-y"
          />
          <Textarea
            value={recommendation}
            onChange={(e) => setRecommendation(e.target.value)}
            placeholder="Pourquoi je recommande cette liste (optionnel)"
            rows={2}
            maxLength={RECO_MAX}
            className="resize-y"
          />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            {isPublic ? "Publique" : "Privée"}
          </label>
          {err && (
            <p role="alert" className="text-sm text-destructive">
              {err}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant="aurora"
            disabled={saving}
            onClick={() => {
              if (!title.trim()) {
                setErr("Le titre est requis.");
                return;
              }
              setErr(null);
              void onSave({ title, description, recommendation, isPublic });
            }}
            className="gap-1.5"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManagePlaylistDialog({
  playlistId,
  title,
  onClose,
}: {
  playlistId: string;
  title: string;
  onClose: () => void;
}) {
  const { data, isLoading } = usePlaylist(playlistId);
  const { addItem, removeItem } = usePlaylistMutations();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const items = data?.items ?? [];
  const addedKeys = useMemo(() => new Set(items.map((i) => i.mediaKey)), [items]);

  const handleAdd = async (item: MediaItem) => {
    setBusyKey(item.key);
    try {
      await addItem.mutateAsync({ playlistId, item });
      toast.success(`« ${item.title} » ajouté.`);
    } catch {
      toast.error("Déjà présent ou impossible d'ajouter.");
    } finally {
      setBusyKey(null);
    }
  };

  const handleRemove = async (mediaKey: string, label: string) => {
    setBusyKey(mediaKey);
    try {
      await removeItem.mutateAsync({ playlistId, mediaKey });
      toast.success(`« ${label} » retiré.`);
    } catch {
      toast.error("Impossible de retirer ce titre.");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="line-clamp-1">Titres — {title}</DialogTitle>
          <DialogDescription>
            Recherchez dans le catalogue KAZEN et composez votre sélection.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <MediaSearchPicker onAdd={handleAdd} addedKeys={addedKeys} busyKey={busyKey} />

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">
              Dans cette collection ({items.length})
            </h3>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun titre pour l'instant. Ajoutez-en via la recherche ci-dessus.
              </p>
            ) : (
              <ul className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
                {items.map((pi) =>
                  pi.item ? (
                    <li
                      key={pi.id}
                      className="flex items-center gap-2 rounded-lg border border-border bg-card/40 p-2"
                    >
                      <SafeImage
                        src={pi.item.posterUrl}
                        alt=""
                        className="h-10 w-7 shrink-0 rounded object-cover ring-1 ring-border"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {pi.item.title}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {MEDIA_TYPE_LABELS[pi.item.mediaType]}
                        </span>
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        disabled={busyKey === pi.mediaKey}
                        onClick={() => handleRemove(pi.mediaKey, pi.item!.title)}
                        aria-label="Retirer"
                      >
                        {busyKey === pi.mediaKey ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                    </li>
                  ) : null,
                )}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="aurora" onClick={onClose} className="gap-1.5">
            <Quote className="h-4 w-4" /> Terminé
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
