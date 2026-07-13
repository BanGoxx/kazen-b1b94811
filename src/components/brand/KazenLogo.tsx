import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * KAZEN brand mark — a geometric monogram "K" set inside a rounded media frame.
 * The angled arms evoke forward motion / an aperture, not a play button.
 * Two variants:
 *  - "gradient": signature aurora frame with a white glyph (default, for surfaces)
 *  - "mono": transparent frame, glyph in currentColor (for tight/monochrome uses)
 */
export function KazenMark({
  className,
  variant = "gradient",
}: {
  className?: string;
  variant?: "gradient" | "mono";
}) {
  const gid = useId();
  const isGradient = variant === "gradient";
  const glyphColor = isGradient ? "#ffffff" : "currentColor";

  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      {isGradient ? (
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#c43a46" />
            <stop offset="0.55" stopColor="#9e1b28" />
            <stop offset="1" stopColor="#6e0f18" />

          </linearGradient>
        </defs>
      ) : null}
      <rect
        x="1.5"
        y="1.5"
        width="37"
        height="37"
        rx="11"
        fill={isGradient ? `url(#${gid})` : "none"}
        stroke={isGradient ? "none" : "currentColor"}
        strokeWidth={isGradient ? 0 : 2.2}
        strokeOpacity={isGradient ? 1 : 0.35}
      />
      <g
        stroke={glyphColor}
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <path d="M13.5 11 V29" />
        <path d="M14.6 20 L27 11" />
        <path d="M14.6 20 L27.5 29" />
      </g>
    </svg>
  );
}

/**
 * Full KAZEN lockup: mark + wordmark. Sizes scale together.
 */
export function KazenLogo({
  className,
  size = "md",
  markVariant = "gradient",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  markVariant?: "gradient" | "mono";
}) {
  const dims = {
    sm: { box: "h-8 w-8", text: "text-base" },
    md: { box: "h-9 w-9", text: "text-lg" },
    lg: { box: "h-12 w-12", text: "text-2xl" },
  }[size];

  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "flex items-center justify-center rounded-xl shadow-[var(--shadow-glow)]",
          dims.box,
        )}
      >
        <KazenMark variant={markVariant} className="h-full w-full" />
      </span>
      <span className={cn("brand-wordmark font-display font-extrabold", dims.text)}>
        KAZEN
      </span>
    </span>
  );
}
