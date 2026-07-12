import { Link } from "@tanstack/react-router";
import { ArrowUpRight, IdCard, Search as SearchIcon, User } from "lucide-react";
import type { CreditPerson } from "@/lib/media-types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type EntityKind = "character" | "staff";

/**
 * Extract the raw AniList node id when the credit id encodes a real node
 * ("c<id>" for characters, "s<id>" for staff). Fallback/random ids return null
 * so we never link to a dead entity page or outbound profile.
 */
function anilistNodeId(person: CreditPerson): string | null {
  const raw = person.id?.slice(1) ?? "";
  return /^\d+$/.test(raw) ? raw : null;
}

function anilistUrl(nodeId: string, kind: EntityKind): string {
  const segment = kind === "character" ? "character" : "staff";
  return `https://anilist.co/${segment}/${nodeId}`;
}

/**
 * Lightweight, premium profile overlay for a clickable cast/staff entity.
 * Shows the data KAZEN actually has (name, role, portrait) plus clean, safe
 * navigation: an internal KAZEN search and, when the id is real, an outbound
 * AniList reference. Renders nothing when no person is selected.
 */
export function EntityProfileDialog({
  person,
  kind,
  open,
  onOpenChange,
}: {
  person: CreditPerson | null;
  kind: EntityKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const nodeId = person ? anilistNodeId(person) : null;
  const external = nodeId ? anilistUrl(nodeId, kind) : null;
  const roleLabel =
    kind === "character" ? "Voix / rôle" : "Rôle";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {person ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {person.photoUrl ? (
                    <img
                      src={person.photoUrl}
                      alt={person.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <User className="h-8 w-8" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 text-left">
                  <DialogTitle className="truncate font-display text-xl">
                    {person.name}
                  </DialogTitle>
                  {person.role ? (
                    <DialogDescription className="mt-1">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">
                        {roleLabel}
                      </span>
                      <span className="mt-0.5 block text-sm font-medium text-foreground/90">
                        {person.role}
                      </span>
                    </DialogDescription>
                  ) : (
                    <DialogDescription className="mt-1 text-sm">
                      {kind === "character"
                        ? "Personnage de ce titre."
                        : "Membre de l'équipe de ce titre."}
                    </DialogDescription>
                  )}
                </div>
              </div>
            </DialogHeader>

            <div className="mt-2 flex flex-col gap-2">
              {nodeId ? (
                <Button asChild className="justify-start">
                  <Link
                    to="/entite/$kind/$id"
                    params={{ kind, id: nodeId }}
                    onClick={() => onOpenChange(false)}
                  >
                    <IdCard className="mr-2 h-4 w-4" />
                    Voir la fiche KAZEN complète
                  </Link>
                </Button>
              ) : null}
              <Button asChild variant="secondary" className="justify-start">
                <Link
                  to="/recherche"
                  search={{ q: person.name }}
                  onClick={() => onOpenChange(false)}
                >
                  <SearchIcon className="mr-2 h-4 w-4" />
                  Explorer « {person.name} » sur KAZEN
                </Link>
              </Button>
              {external ? (
                <Button asChild variant="outline" className="justify-start">
                  <a href={external} target="_blank" rel="noopener noreferrer">
                    <ArrowUpRight className="mr-2 h-4 w-4" />
                    Fiche détaillée (AniList)
                  </a>
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
