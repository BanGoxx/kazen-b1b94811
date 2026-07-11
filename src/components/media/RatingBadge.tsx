import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** score is normalized 0-100; displayed on /10. */
export function RatingBadge({ score, className }: { score: number | null; className?: string }) {
  if (score == null) return null;
  const out10 = (score / 10).toFixed(1);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-background/80 px-2 py-0.5 text-xs font-semibold text-foreground backdrop-blur",
        className,
      )}
    >
      <Star className="h-3 w-3 fill-accent text-accent" />
      {out10}
    </span>
  );
}
