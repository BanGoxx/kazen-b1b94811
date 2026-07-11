import { PLATFORMS } from "@/lib/platforms";
import { SectionHeader } from "./SectionHeader";

// Editorial platform showcase for the Discover page. Uses the internal
// platform registry so branding stays coherent app-wide.
const HIGHLIGHT_IDS = [
  "netflix",
  "crunchyroll",
  "prime",
  "disney",
  "adn",
  "canal",
  "max",
  "appletv",
];

export function PlatformHighlights() {
  const platforms = HIGHLIGHT_IDS.map((id) => PLATFORMS.find((p) => p.id === id)!).filter(Boolean);

  return (
    <section className="animate-fade-in">
      <SectionHeader
        title="Plateformes"
        subtitle="Où regarder vos anime, séries et films préférés"
      />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {platforms.map((p) => (
          <li key={p.id}>
            <div
              className="hover-lift group relative flex h-24 items-center justify-center overflow-hidden rounded-2xl border border-border bg-card/60 p-4 text-center"
              style={{
                boxShadow: `inset 0 1px 0 0 oklch(1 0 0 / 0.05)`,
              }}
            >
              <span
                aria-hidden="true"
                className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-30 blur-2xl transition-opacity duration-500 group-hover:opacity-60"
                style={{ backgroundColor: p.color }}
              />
              <span className="relative font-display text-lg font-bold tracking-tight text-foreground">
                {p.name}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
