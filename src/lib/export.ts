import type { ExportEntry, ExportPayload } from "./export.functions";

// Client-side formatting + download helpers for KAZEN data export.

const CSV_COLUMNS: { key: keyof ExportEntry; label: string }[] = [
  { key: "title", label: "title" },
  { key: "original_title", label: "original_title" },
  { key: "type", label: "type" },
  { key: "year", label: "year" },
  { key: "source", label: "source" },
  { key: "external_id", label: "external_id" },
  { key: "anilist_id", label: "anilist_id" },
  { key: "tmdb_id", label: "tmdb_id" },
  { key: "status", label: "status" },
  { key: "rating", label: "rating" },
  { key: "notes", label: "notes" },
  { key: "tags", label: "tags" },
  { key: "progress", label: "progress" },
  { key: "started_at", label: "started_at" },
  { key: "completed_at", label: "completed_at" },
  { key: "rewatch_count", label: "rewatch_count" },
  { key: "is_rewatching", label: "is_rewatching" },
  { key: "created_at", label: "created_at" },
  { key: "updated_at", label: "updated_at" },
  { key: "import_provider", label: "import_provider" },
  { key: "import_ref", label: "import_ref" },
];

function csvCell(value: unknown): string {
  if (value == null) return "";
  const str = Array.isArray(value) ? value.join("; ") : String(value);
  // Escape by wrapping in quotes and doubling any embedded quotes. Always quote
  // so commas, newlines and semicolons are safe across spreadsheet apps.
  return `"${str.replace(/"/g, '""')}"`;
}

export function toCsv(payload: ExportPayload): string {
  const header = CSV_COLUMNS.map((c) => c.label).join(",");
  const rows = payload.entries.map((e) =>
    CSV_COLUMNS.map((c) => csvCell(e[c.key])).join(","),
  );
  // Prepend BOM for correct UTF-8 rendering in Excel.
  return "\uFEFF" + [header, ...rows].join("\r\n");
}

export function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportFileName(ext: "json" | "csv"): string {
  const date = new Date().toISOString().slice(0, 10);
  return `kazen-export-${date}.${ext}`;
}
