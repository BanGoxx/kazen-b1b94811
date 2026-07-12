import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Discreet, premium floating "back to top" control.
 *
 * Appears only after the user has scrolled past a threshold, sits bottom-right
 * (nudged clear of the mobile assistant launcher), scrolls smoothly to the top,
 * and honors reduced-motion preferences. Rendered once in AppShell so every
 * KAZEN surface gets it without touching individual routes.
 */
export function BackToTop({ threshold = 600 }: { threshold?: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  const scrollToTop = () => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Remonter en haut"
      title="Remonter en haut"
      tabIndex={visible ? 0 : -1}
      className={cn(
        "focus-ring fixed bottom-24 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card/80 text-foreground shadow-lg backdrop-blur transition-all duration-300 hover:border-primary/40 hover:text-primary sm:bottom-6 lg:right-6",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0",
      )}
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}
