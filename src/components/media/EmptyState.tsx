import { SearchX } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function EmptyState({
  message,
  hint,
  action,
}: {
  message?: string;
  hint?: string;
  action?: { label: string; to: string };
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SearchX className="h-6 w-6" />
      </div>
      <p className="text-sm font-medium text-foreground">{message ?? t.catalog.empty}</p>
      {hint ? <p className="max-w-sm text-sm text-muted-foreground">{hint}</p> : null}
      {action ? (
        <Button asChild variant="aurora" size="sm" className="mt-1">
          <Link to={action.to}>{action.label}</Link>
        </Button>
      ) : null}
    </div>
  );
}
