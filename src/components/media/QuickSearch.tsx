import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

// Curated popular titles used to power lightweight predictive suggestions in
// the Discover hero. Full results still live on /recherche.
const POPULAR_TITLES = [
  "Demon Slayer",
  "One Piece",
  "Jujutsu Kaisen",
  "Frieren",
  "Attack on Titan",
  "Chainsaw Man",
  "Dune",
  "Oppenheimer",
  "The Last of Us",
  "Arcane",
  "Spy x Family",
  "Blue Lock",
];

// Compact search launcher for the Discover hero area. Submits to /recherche
// with the typed query so the full search page owns the results state.
export function QuickSearch({ className }: { className?: string }) {
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const navigate = useNavigate();

  const go = (value: string) => {
    navigate({ to: "/recherche", search: { q: value.trim() || undefined } });
  };

  const suggestions = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return POPULAR_TITLES.slice(0, 6);
    return POPULAR_TITLES.filter((t) => t.toLowerCase().includes(term)).slice(0, 6);
  }, [q]);

  const showPanel = focused && suggestions.length > 0;

  return (
    <div className={cn("relative w-full max-w-xl", className)}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          go(q);
        }}
      >
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          placeholder="Rechercher un anime, une série, un film…"
          aria-label="Rechercher"
          className="focus-ring h-14 w-full rounded-2xl border border-border bg-card/70 pl-12 pr-28 text-base text-foreground shadow-card backdrop-blur placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl aurora-bg px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition-opacity hover:opacity-90 focus-ring"
        >
          Explorer
        </button>
      </form>

      {showPanel ? (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-border bg-popover/95 p-1.5 shadow-elevated backdrop-blur">
          <p className="px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
            {q.trim() ? "Suggestions" : "Populaires en ce moment"}
          </p>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go(s)}
              className="focus-ring flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
            >
              <TrendingUp className="h-4 w-4 shrink-0 text-primary" />
              {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
