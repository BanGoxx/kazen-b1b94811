/**
 * Reliable external navigation helper.
 *
 * KAZEN runs inside an embedded/sandboxed preview iframe. Calling
 * `window.open()` (or navigating the current frame) toward providers such as
 * Crunchyroll fails with `ERR_BLOCKED_BY_RESPONSE`, because those sites send
 * `X-Frame-Options`/CSP headers that forbid being loaded inside a frame.
 *
 * To always leave KAZEN as a genuine top-level external navigation, we
 * synthesize a real anchor click with `target="_blank"` + `rel` guards. A
 * user-gesture anchor click is the most portable way to break out of a
 * sandboxed frame and land in a fresh browser tab. If the popup is blocked we
 * fall back to navigating the top-most window.
 */
export function openExternal(url: string | null | undefined): void {
  if (!url) return;
  if (typeof document === "undefined") return;

  try {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer external";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch {
    // Last-resort fallback: navigate the top-level window so we never try to
    // load a frame-blocking provider inside the sandboxed app frame.
    try {
      const top = window.top ?? window;
      top.location.href = url;
    } catch {
      window.location.href = url;
    }
  }
}
