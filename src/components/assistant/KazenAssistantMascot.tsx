import { useEffect, useRef, useState } from "react";
import { useAssistantOpen, openAssistant } from "@/lib/assistant-open";

// KAZEN AI assistant mascot.
// A small animated character that sits above the existing assistant launcher.
// It reuses the assistant's shared open state (`useAssistantOpen`) and open
// function — it never duplicates the chat, its button, or its logic.
//
// Two visual modes:
//   • intro    — first session only: full size, opacity 1, idle→wave→point→idle
//                with the "Coucou !" bubble.
//   • discreet — after the intro, after the chat closes, and on later routes:
//                smaller, semi-transparent, ultra-subtle idle. Never replays
//                the intro.
// When the chat panel is open the mascot fades out and unmounts (removed from
// the DOM and the tab order — not merely placed behind the panel).

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
  // Discreet mode: true once the intro has played (or is skipped).
  const [discreet, setDiscreet] = useState(true);
  // Keeps the node in the DOM briefly while it fades out on chat open.
  const [render, setRender] = useState(true);
  // Hover/focus lifts opacity; scroll activity lowers it.
  const [hovered, setHovered] = useState(false);
  const [scrolling, setScrolling] = useState(false);
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

    // Reduced motion or intro already played → straight to discreet mode.
    if (reduced || alreadyShown) {
      setDiscreet(true);
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

    // Intro mode: full size / opacity while the sequence plays.
    setDiscreet(false);

    // Timeline (cross-fade does not shorten pose visibility):
    //   0–500ms   idle
    //   500–2300ms wave + "Coucou !" bubble
    //   2300–4300ms point (bubble already gone)
    //   4300ms+    back to idle + switch to discreet mode
    const t1 = setTimeout(() => {
      setPose("wave");
      setShowBubble(true);
    }, 500);
    const tBubble = setTimeout(() => {
      setShowBubble(false);
    }, 2100);
    const t2 = setTimeout(() => {
      setPose("point");
    }, 2300);
    const t3 = setTimeout(() => {
      setPose("idle");
      setDiscreet(true);
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

  // Panel open/close: fully hide (fade out then unmount) while open; on close
  // return to the discreet idle pose without replaying the intro.
  useEffect(() => {
    if (open) {
      setShowBubble(false);
      setVisible(false);
      const t = setTimeout(() => setRender(false), 220);
      return () => clearTimeout(t);
    }
    setRender(true);
    setPose("idle");
    setDiscreet(true);
    const t = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(t);
  }, [open]);

  // Lightly dim the mascot while the page is actively scrolling, restoring it
  // shortly after scrolling stops. Passive listener + single debounce timer —
  // no per-frame position work, no observers.
  useEffect(() => {
    if (!mounted || reduced) return;
    let idle: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      setScrolling(true);
      if (idle) clearTimeout(idle);
      idle = setTimeout(() => setScrolling(false), 220);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (idle) clearTimeout(idle);
    };
  }, [mounted, reduced]);

  if (!mounted || open || !render) return null;

  // Per-pose micro-animation applied to the active layer only.
  function poseAnimation(p: Pose): string | undefined {
    if (reduced) return undefined;
    if (p === "idle") {
      return discreet
        ? "kazenMascotIdleDiscreet 4s ease-in-out infinite alternate"
        : "kazenMascotIdle 3s ease-in-out infinite alternate";
    }
    switch (p) {
      case "wave":
        return "kazenMascotWave 1.6s ease-in-out infinite";
      case "point":
        return "kazenMascotPoint 1.4s ease-in-out infinite alternate";
      default:
        return undefined;
    }
  }

  // Resting opacity: full during intro, semi-transparent when discreet.
  // Hover/focus lifts it; active scrolling lowers it a touch.
  const restOpacity = discreet ? (scrolling ? 0.5 : 0.65) : 1;
  const targetOpacity = !visible ? 0 : hovered ? 0.98 : restOpacity;

  // Discreet mode sits directly above the assistant launcher (button top is
  // ~76px: bottom-5 20px + h-14 56px), leaving only a ~4-8px gap; intro mode
  // hugs the launcher so its arrow points at it.
  const wrapperPos = discreet
    ? "bottom-[5.25rem] right-5 sm:bottom-[5.5rem] sm:right-6"
    : "bottom-[5.5rem] right-3 sm:bottom-[6.25rem] sm:right-5";

  const boxSize = discreet
    ? "h-[62px] w-[62px] sm:h-[80px] sm:w-[80px] lg:h-[100px] lg:w-[100px]"
    : "h-[75px] w-[75px] md:h-[112px] md:w-[112px] lg:h-[132px] lg:w-[132px]";

  return (
    <div
      className={`pointer-events-none fixed z-40 flex flex-col items-center gap-1 transition-all duration-300 ${wrapperPos}`}
      style={{
        opacity: targetOpacity,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      aria-hidden={false}
    >
      {showBubble && !discreet && (
        <div className="pointer-events-none mb-0.5 animate-scale-in rounded-2xl border border-primary/70 bg-card px-3 py-1 text-xs font-semibold text-foreground shadow-lg">
          Coucou&nbsp;!
        </div>
      )}
      <button
        type="button"
        onClick={openAssistant}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        aria-label="Ouvrir l'assistant KAZEN"
        className="focus-ring pointer-events-auto group relative rounded-full outline-none transition-transform duration-300 hover:scale-105 active:scale-95"
      >
        {/* Fixed display box — all poses stacked, cross-faded via opacity.
            object-contain + bottom center keeps the silhouette's feet aligned
            despite the three source assets having different aspect ratios. */}
        <span className={`relative block ${boxSize}`}>
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
        {/* Discreet pulsing arrow toward the chat button, only while pointing
            during the intro. */}
        {!reduced && !discreet && pose === "point" && (
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
