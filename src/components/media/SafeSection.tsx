import { Component, Suspense, type ReactNode } from "react";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { RotateCw } from "lucide-react";
import { reportLovableError } from "@/lib/lovable-error-reporting";

interface BoundaryProps {
  children: ReactNode;
  onReset: () => void;
  fallback: (retry: () => void) => ReactNode;
}

// Local class boundary so a single failing data block degrades gracefully
// instead of collapsing the whole page into the runtime error overlay.
class SectionErrorBoundary extends Component<BoundaryProps, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    reportLovableError(
      error instanceof Error ? error : new Error(String(error)),
      { boundary: "safe_section" },
    );
  }

  retry = () => {
    this.props.onReset();
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) return this.props.fallback(this.retry);
    return this.props.children;
  }
}

function DefaultFallback({ retry, minHeight }: { retry: () => void; minHeight: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/40 px-6 py-10 text-center"
      style={{ minHeight }}
    >
      <p className="text-sm text-muted-foreground">
        Cette section n'a pas pu se charger.
      </p>
      <button
        type="button"
        onClick={retry}
        className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <RotateCw className="h-3.5 w-3.5" /> Réessayer
      </button>
    </div>
  );
}

/**
 * Isolates a data-driven section: its own error boundary contains fetch/render
 * failures, and its own Suspense boundary shows a local pending state. Failures
 * never bubble up to the route-level or app-level error overlay.
 */
export function SafeSection({
  children,
  pending,
  errorFallback,
  minHeight = "8rem",
}: {
  children: ReactNode;
  pending?: ReactNode;
  errorFallback?: ReactNode;
  minHeight?: string;
}) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <SectionErrorBoundary
          onReset={reset}
          fallback={(retry) =>
            errorFallback ?? <DefaultFallback retry={retry} minHeight={minHeight} />
          }
        >
          <Suspense fallback={pending ?? null}>{children}</Suspense>
        </SectionErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
