import { useEffect, useRef, useState } from "react";
import { useAssistantOpen, openAssistant } from "@/lib/assistant-open";

// KAZEN AI assistant mascot.
// A small animated character that sits just above/left of the existing
// assistant launcher. It reuses the assistant's shared open state and open
// function — it never duplicates the chat, its button, or its logic.

type Pose = "idle" | "wave" | "point";

const POSES: Record<Pose, string> = {
  idle: "/mascot/kazen-mascot-idle.png",
  wave: "/mascot/kazen-mascot-wave.png",
  point: "/mascot/kazen-mascot-point.png",
};

const INTRO_KEY = "kazen-mascot-intro-shown";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function KazenAssistantMascot() {
  const open = useAssistantOpen();
  const [mounted, setMounted] = useState(false);
  const [pose, setPose] = useState<Pose>("idle");
  const [showBubble, setShowBubble] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Client-only render to avoid any hydration mismatch on session/media checks.
  useEffect(() => {
    setMounted(true);
    setReduced(prefersReducedMotion());
  }, []);

  // Preload wave/point after first render (idle is loaded eagerly in markup).
  useEffect(() => {
    if (!mounted) return;
    const wave = new Image();
    wave.src = POSES.wave;
    const point = new Image();
    point.src = POSES.point;
  }, [mounted]);

  // Intro sequence — once per session, and never while the panel is open.
  useEffect(() => {
    if (!mounted || open) return;

    // Fade in gently on mount.
    const inTimer = setTimeout(() => setVisible(true), 20);
    timers.current.push(inTimer);

    let alreadyShown = false;
    try {
      alreadyShown = sessionStorage.getItem(INTRO_KEY) === "1";
    } catch {
      alreadyShown = true;
    }

    if (reduced || alreadyShown) {
      setPose("idle");
      setShowBubble(false);
      return () => {
        clearTimeout(inTimer);
      };
    }

    try {
      sessionStorage.setItem(INTRO_KEY, "1");
    } catch {
      /* ignore */
    }

    // 0–400ms idle, 400–1800ms wave + bubble, 1800–3400ms point, then idle.
    const t1 = setTimeout(() => {
      setPose("wave");
      setShowBubble(true);
    }, 400);
    const t2 = setTimeout(() => {
      setPose("point");
    }, 1800);
    const t3 = setTimeout(() => {
      setPose("idle");
      setShowBubble(false);
    }, 3400);
    timers.current.push(t1, t2, t3);

    return () => {
      clearTimeout(inTimer);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
    // Intro should run only on first mount; open transitions handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // Clean up any lingering timers on unmount.
  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, []);

  // When the panel opens, hide the mascot; when it closes, show idle again
  // (without replaying the full intro).
  useEffect(() => {
    if (open) {
      setShowBubble(false);
    } else {
      setPose("idle");
    }
  }, [open]);

  if (!mounted || open) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-[5.5rem] right-3 z-40 flex flex-col items-center gap-1 transition-opacity duration-500 sm:bottom-[6.25rem] sm:right-5"
      style={{
        opacity: visible ? 1 : 0,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      aria-hidden={false}
    >
      {showBubble && (
        <div className="pointer-events-none mb-0.5 animate-fade-in rounded-2xl border border-primary/70 bg-card px-3 py-1 text-xs font-semibold text-foreground shadow-lg">
          Coucou&nbsp;!
        </div>
      )}
      <button
        type="button"
        onClick={openAssistant}
        aria-label="Ouvrir l'assistant KAZEN"
        className="focus-ring pointer-events-auto group relative rounded-full outline-none transition-transform duration-300 hover:scale-105 active:scale-95"
      >
        <img
          src={POSES[pose]}
          alt=""
          width={130}
          height={130}
          draggable={false}
          className="h-[75px] w-auto select-none drop-shadow-[0_6px_16px_rgba(0,0,0,0.45)] transition-[filter] duration-300 group-hover:drop-shadow-[0_6px_20px_hsl(var(--primary)/0.55)] md:h-[112px] lg:h-[132px]"
          style={
            !reduced && pose === "idle"
              ? { animation: "kazenMascotIdle 3s ease-in-out infinite alternate" }
              : undefined
          }
        />
      </button>
    </div>
  );
}
