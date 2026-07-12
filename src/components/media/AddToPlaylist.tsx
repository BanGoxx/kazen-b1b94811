import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ListPlus, Plus, Check, Loader2, LogIn } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useMyPlaylists, usePlaylistMutations } from "@/lib/playlists";
import type { MediaItem } from "@/lib/media-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function AddToPlaylist({ item }: { item: MediaItem }) {
  const { user, ready } = useAuth();
  const [open, setOpen] = useState(false);
  const { data: playlists = [], isLoading } = useMyPlaylists();
  const { create, addItem } = usePlaylistMutations();
  const [newTitle, setNewTitle] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleAdd = async (playlistId: string) => {
    setBusyId(playlistId);
    try {
      await addItem.mutateAsync({ playlistId, item });
      toast.success("Ajouté à la playlist.");
    } catch {
      toast.error("Déjà présent ou impossible d'ajouter.");
    } finally {
      setBusyId(null);
    }
  };

  const handleCreate = async () => {
    const title = newTitle.trim();
    if (!title) return;
    try {
      const id = await create.mutateAsync({ title });
      await addItem.mutateAsync({ playlistId: id, item });
      setNewTitle("");
      toast.success("Playlist créée et titre ajouté.");
    } catch {
      toast.error("Impossible de créer la playlist.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full gap-2">
          <ListPlus className="h-4 w-4" /> Ajouter à une playlist
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter à une playlist</DialogTitle>
        </DialogHeader>

        {ready && !user ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Connectez-vous pour créer et partager des playlists.
            </p>
            <Button asChild variant="aurora" size="sm">
              <Link to="/auth" search={{ redirect: undefined }}>
                <LogIn className="mr-1 h-4 w-4" /> Se connecter
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Nouvelle playlist…"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              <Button
                variant="aurora"
                onClick={handleCreate}
                disabled={create.isPending || !newTitle.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="max-h-72 space-y-1.5 overflow-y-auto">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Chargement…</p>
              ) : playlists.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucune playlist. Créez-en une ci-dessus.
                </p>
              ) : (
                playlists.map((pl) => (
                  <button
                    key={pl.id}
                    type="button"
                    onClick={() => handleAdd(pl.id)}
                    disabled={busyId === pl.id}
                    className="focus-ring flex w-full items-center justify-between rounded-xl border border-border bg-card/50 px-3 py-2 text-left transition-colors hover:bg-card"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {pl.title}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {pl.count} titre{pl.count > 1 ? "s" : ""} ·{" "}
                        {pl.isPublic ? "Publique" : "Privée"}
                      </span>
                    </span>
                    {busyId === pl.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                      <Check className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
