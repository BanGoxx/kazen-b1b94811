import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ExpandableTextProps {
  text: string;
  /** Character threshold above which the text is clamped. */
  limit?: number;
}

/**
 * Synopsis-friendly text block: shows a trimmed preview with a smooth
 * "Lire plus / Lire moins" toggle so long synopses never overload the page.
 */
export function ExpandableText({ text, limit = 420 }: ExpandableTextProps) {
  const [open, setOpen] = useState(false);
  const needsClamp = text.length > limit;
  const shown = open || !needsClamp ? text : `${text.slice(0, limit).trimEnd()}…`;

  return (
    <div>
      <p className="max-w-3xl whitespace-pre-line leading-relaxed text-muted-foreground">
        {shown}
      </p>
      {needsClamp ? (
        <Button
          variant="link"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          className="mt-1 h-auto px-0 text-primary"
        >
          {open ? "Lire moins" : "Lire plus"}
        </Button>
      ) : null}
    </div>
  );
}
