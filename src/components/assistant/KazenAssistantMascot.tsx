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

const POSE_ORDER: Pose[] = ["idle", "wave", "point"];

// sessionStorage key used to gate the once-per-session intro.
// To replay the intro in preview, run in the console:
//   sessionStorage.removeItem("kazen-mascot-intro-shown")
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

    // Timeline (cross-fade does not shorten pose visibility):
    //   0–500ms   idle
    //   500–2300ms wave + "Coucou !" bubble
    //   2300–4300ms point (bubble already gone)
    //   4300ms+    back to idle
    const t1 = setTimeout(() => {
      setPose("wave");
      setShowBubble(true);
    }, 500);
    const tBubble = setTimeout(() => {
      // Bubble fades out softly before the point pose.
      setShowBubble(false);
    }, 2100);
    const t2 = setTimeout(() => {
      setPose("point");
    }, 2300);
    const t3 = setTimeout(() => {
      setPose("idle");
    }, 4300);
    timers.current.push(t1, tBubble, t2, t3);

    return () => {
      clearTimeout(inTimer);
      clearTimeout(t1);
      clearTimeout(tBubble);
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

  // Per-pose micro-animation applied to the active layer only.
  function poseAnimation(p: Pose): string | undefined {
    if (reduced) return undefined;
    switch (p) {
      case "idle":
        return "kazenMascotIdle 3s ease-in-out infinite alternate";
      case "wave":
        return "kazenMascotWave 1.6s ease-in-out infinite";
      case "point":
        return "kazenMascotPoint 1.4s ease-in-out infinite alternate";
      default:
        return undefined;
    }
  }

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
        <div className="pointer-events-none mb-0.5 animate-scale-in rounded-2xl border border-primary/70 bg-card px-3 py-1 text-xs font-semibold text-foreground shadow-lg">
          Coucou&nbsp;!
        </div>
      )}
      <button
        type="button"
        onClick={openAssistant}
        aria-label="Ouvrir l'assistant KAZEN"
        className="focus-ring pointer-events-auto group relative rounded-full outline-none transition-transform duration-300 hover:scale-105 active:scale-95"
      >
        {/* Fixed display box — all poses stacked, cross-faded via opacity.
            object-contain + bottom center keeps the silhouette's feet aligned
            despite the three source assets having different aspect ratios. */}
        <span className="relative block h-[75px] w-[75px] md:h-[112px] md:w-[112px] lg:h-[132px] lg:w-[132px]">
          {POSE_ORDER.map((p) => {
            const active = p === pose;
            return (
              <img
                key={p}
                src={POSES[p]}
                alt=""
                draggable={false}
                aria-hidden="true"
                className={`mascot-layer mascot-glow${
                  active && p === "point" ? " mascot-glow-point" : ""
                } absolute inset-0 h-full w-full select-none`}
                style={{
                  objectFit: "contain",
                  objectPosition: "bottom center",
                  opacity: active ? 1 : 0,
                  animation: active ? poseAnimation(p) : undefined,
                }}
              />
            );
          })}
        </span>
        {/* Discreet pulsing arrow toward the chat button, only while pointing. */}
        {!reduced && pose === "point" && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-2 left-1/2 -translate-x-1/2 text-primary"
            style={{ animation: "kazenMascotArrowPulse 1.2s ease-in-out infinite" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" />
              <path d="m19 12-7 7-7-7" />
            </svg>
          </span>
        )}
      </button>
    </div>
  );
}
