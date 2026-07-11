import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

// Compact search launcher for the Discover hero area. Submits to /recherche
// with the typed query so the full search page owns the results state.
export function QuickSearch({ className }: { className?: string }) {
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        navigate({ to: "/recherche", search: { q: q.trim() || undefined } });
      }}
      className={cn("relative w-full max-w-xl", className)}
    >
      <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
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
  );
}
