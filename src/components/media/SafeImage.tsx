import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * KAZEN-styled inline fallback artwork (graphite & ember). Rendered as an SVG
 * data-URI so it always loads instantly, never 404s, and matches the theme —
 * no broken-image icons ever surface, whatever happens to the remote poster.
 */
function fallbackDataUri(variant: "poster" | "backdrop", label?: string): string {
  const w = variant === "poster" ? 300 : 1280;
  const h = variant === "poster" ? 450 : 720;
  const title = (label ?? "KAZEN").slice(0, 40);
  const fontSize = variant === "poster" ? 26 : 54;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#17161a"/>
      <stop offset="0.55" stop-color="#201c1d"/>
      <stop offset="1" stop-color="#2a1c18"/>
    </linearGradient>
    <radialGradient id="e" cx="0.5" cy="0.42" r="0.7">
      <stop offset="0" stop-color="#e8623a" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#e8623a" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <rect width="${w}" height="${h}" fill="url(#e)"/>
  <g fill="#f4ead9" opacity="0.92" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif">
    <text x="50%" y="46%" font-size="${fontSize}" letter-spacing="6" font-weight="700">KAZEN</text>
    <text x="50%" y="54%" font-size="${Math.round(fontSize * 0.4)}" fill="#e8623a" letter-spacing="2" font-family="system-ui, sans-serif">${escapeXml(title)}</text>
  </g>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] as string),
  );
}

type SafeImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string | null | undefined;
  variant?: "poster" | "backdrop";
  fallbackLabel?: string;
};

/**
 * Drop-in <img> replacement that guarantees a complete visual: if `src` is
 * empty or the remote image fails to load, it swaps to a KAZEN-styled inline
 * fallback instead of showing a broken-image icon.
 */
export function SafeImage({ src, variant = "poster", fallbackLabel, className, alt, ...rest }: SafeImageProps) {
  const fallback = fallbackDataUri(variant, fallbackLabel);
  const [current, setCurrent] = useState(src || fallback);

  useEffect(() => {
    setCurrent(src || fallback);
  }, [src, fallback]);

  return (
    <img
      {...rest}
      src={current}
      alt={alt ?? ""}
      className={cn(className)}
      onError={() => {
        if (current !== fallback) setCurrent(fallback);
      }}
    />
  );
}

export { fallbackDataUri };
