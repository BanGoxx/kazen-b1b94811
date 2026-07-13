import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Flag, MoreVertical, EyeOff, Eye, Trash2, RotateCcw, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AuthorLite } from "@/lib/forum";
import { useReportForum, useModerateForum } from "@/lib/forum";
import { cn } from "@/lib/utils";

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const s = Math.round(diff / 1000);
  if (s < 60) return "à l'instant";
  const m = Math.round(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `il y a ${d} j`;
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

export function AuthorByline({
  author,
  when,
  edited = false,
  size = "sm",
}: {
  author: AuthorLite;
  when: string;
  edited?: boolean;
  size?: "sm" | "md";
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Avatar className={cn(size === "md" ? "h-8 w-8" : "h-6 w-6")}>
        {author.avatarUrl && <AvatarImage src={author.avatarUrl} alt="" />}
        <AvatarFallback className="bg-muted text-[9px]">
          {initials(author.displayName)}
        </AvatarFallback>
      </Avatar>
      <span className="font-medium text-foreground/90">{author.displayName}</span>
      <span aria-hidden>·</span>
      <time dateTime={when}>{timeAgo(when)}</time>
      {edited && <span className="italic opacity-70">(modifié)</span>}
    </div>
  );
}

const REPORT_REASONS = [
  { value: "spam", label: "Spam ou publicité" },
  { value: "harcelement", label: "Harcèlement ou insultes" },
  { value: "hors-sujet", label: "Hors-sujet" },
  { value: "contenu-inapproprie", label: "Contenu inapproprié" },
  { value: "autre", label: "Autre" },
];

export function ReportButton({
  targetType,
  targetId,
  isAuthenticated,
}: {
  targetType: "topic" | "post";
  targetId: string;
  isAuthenticated: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const report = useReportForum();

  if (!isAuthenticated) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
      >
        <Flag className="h-3.5 w-3.5" /> Signaler
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Signaler ce contenu</DialogTitle>
            <DialogDescription>
              Merci d'aider à garder la communauté KAZEN saine. Un modérateur examinera ce
              signalement.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Motif</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-details">Détails (facultatif)</Label>
              <Textarea
                id="report-details"
                value={details}
                onChange={(e) => setDetails(e.target.value.slice(0, 2000))}
                placeholder="Précisez le problème si besoin…"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="aurora"
              disabled={report.isPending}
              onClick={async () => {
                try {
                  const label = REPORT_REASONS.find((r) => r.value === reason)?.label ?? reason;
                  await report.mutateAsync({ targetType, targetId, reason: label, details });
                  toast.success("Signalement envoyé", {
                    description: "Merci, l'équipe de modération va l'examiner.",
                  });
                  setOpen(false);
                  setDetails("");
                } catch (e) {
                  toast.error("Impossible d'envoyer le signalement", {
                    description: e instanceof Error ? e.message : undefined,
                  });
                }
              }}
            >
              Envoyer le signalement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ModerationMenu({
  targetType,
  targetId,
  hidden,
  deleted,
  canModerate,
  isAuthor,
  onEdit,
  onDelete,
}: {
  targetType: "topic" | "post";
  targetId: string;
  hidden: boolean;
  deleted: boolean;
  canModerate: boolean;
  isAuthor: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const moderate = useModerateForum();
  if (!canModerate && !isAuthor) return null;

  async function run(action: "hide" | "unhide" | "soft_delete" | "restore") {
    try {
      await moderate.mutateAsync({ targetType, targetId, action });
      toast.success("Action de modération appliquée");
    } catch (e) {
      toast.error("Action impossible", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          aria-label="Options"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {isAuthor && onEdit && (
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" /> Modifier
          </DropdownMenuItem>
        )}
        {(isAuthor || canModerate) && onDelete && (
          <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" /> Supprimer
          </DropdownMenuItem>
        )}
        {canModerate && (
          <>
            {(isAuthor && onDelete) || (isAuthor && onEdit) ? <DropdownMenuSeparator /> : null}
            {hidden ? (
              <DropdownMenuItem onClick={() => run("unhide")}>
                <Eye className="mr-2 h-4 w-4" /> Rendre visible
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => run("hide")}>
                <EyeOff className="mr-2 h-4 w-4" /> Masquer
              </DropdownMenuItem>
            )}
            {deleted ? (
              <DropdownMenuItem onClick={() => run("restore")}>
                <RotateCcw className="mr-2 h-4 w-4" /> Restaurer
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => run("soft_delete")}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" /> Supprimer (modération)
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SignInToParticipate({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 px-5 py-6 text-center">
      <p className="text-sm text-muted-foreground">
        {label}{" "}
        <Link
          to="/auth"
          search={{ redirect: "/communaute" }}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Connectez-vous
        </Link>{" "}
        pour participer.
      </p>
    </div>
  );
}
