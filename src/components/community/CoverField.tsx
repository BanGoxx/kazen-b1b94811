import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SafeImage } from "@/components/media/SafeImage";
import { ALLOWED_COVER_LABEL, validateCoverFile } from "@/lib/forum-cover";
import { cn } from "@/lib/utils";

interface CoverFieldProps {
  /** Locally selected (not-yet-uploaded) file. */
  file: File | null;
  onFile: (file: File | null) => void;
  alt: string;
  onAlt: (alt: string) => void;
  /** Existing signed URL of an already-saved cover (edit context). */
  existingUrl?: string | null;
  /** Whether a saved cover currently exists (edit context). */
  hasExisting?: boolean;
  onRemoveExisting?: () => void;
  disabled?: boolean;
  busy?: boolean;
}

/**
 * Optional cover selector for community threads. Manual upload only in Phase 11;
 * the AI generation control is a non-misleading disabled readiness state (no
 * provider is configured, so nothing is called).
 */
export function CoverField({
  file,
  onFile,
  alt,
  onAlt,
  existingUrl,
  hasExisting,
  onRemoveExisting,
  disabled,
  busy,
}: CoverFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setLocalUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setLocalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const previewUrl = localUrl ?? existingUrl ?? null;
  const showRemove = Boolean(file) || Boolean(hasExisting);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!f) return;
    setError(null);
    const v = await validateCoverFile(f);
    if (!v.ok) {
      setError(v.error ?? "Image invalide.");
      return;
    }
    onFile(f);
  }

  function remove() {
    setError(null);
    if (file) onFile(null);
    else if (hasExisting) onRemoveExisting?.();
  }

  return (
    <div className="space-y-2">
      <Label>Image de couverture (optionnelle)</Label>
      <div
        className={cn(
          "overflow-hidden rounded-xl border border-border bg-card/40",
          previewUrl ? "" : "border-dashed",
        )}
      >
        {previewUrl ? (
          <div className="relative aspect-[16/6] w-full bg-muted/40">
            <SafeImage
              src={previewUrl}
              variant="backdrop"
              alt={alt || "Aperçu de la couverture"}
              className="h-full w-full object-cover"
            />
            {busy && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => inputRef.current?.click()}
            className="flex aspect-[16/6] w-full flex-col items-center justify-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
          >
            <ImagePlus className="h-6 w-6" />
            <span className="text-sm font-medium">Ajouter une couverture</span>
            <span className="text-[11px]">{ALLOWED_COVER_LABEL}</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={pick}
        disabled={disabled || busy}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
          className="gap-1.5"
        >
          <ImagePlus className="h-4 w-4" />
          {previewUrl ? "Remplacer" : "Choisir une image"}
        </Button>
        {showRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || busy}
            onClick={remove}
            className="gap-1.5 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" /> Retirer
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled
          title="La génération d'image par IA arrivera dans une prochaine version."
          className="gap-1.5 opacity-60"
        >
          <Sparkles className="h-4 w-4" /> Générer par IA (bientôt)
        </Button>
      </div>

      {previewUrl && (
        <div className="space-y-1.5">
          <Label htmlFor="cover-alt" className="text-xs text-muted-foreground">
            Texte alternatif (accessibilité)
          </Label>
          <Input
            id="cover-alt"
            value={alt}
            onChange={(e) => onAlt(e.target.value.slice(0, 200))}
            placeholder="Décrivez brièvement l'image"
            disabled={disabled || busy}
          />
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-[11px] text-muted-foreground">
        N'utilisez pas d'affiche officielle laissant croire à un partenariat. Préférez une image
        thématique. Formats acceptés : {ALLOWED_COVER_LABEL}.
      </p>
    </div>
  );
}
