// KAZEN — Nautiljon list parser (DEV-ONLY discovery prototype).
//
// ⚠️ This module NEVER fetches or crawls Nautiljon. It only parses an HTML
// STRING that the user themselves saved from their own logged-in list page and
// pasted/dropped into a local dev tool. No network, no credentials, no cookies.
//
// It intentionally reads ONLY tracking metadata (title, status, score,
// progress, dates, episode count). It ignores images, synopsis, editorial
// content and anything unrelated to the user's own list rows.
//
// Nautiljon renders a member's anime list as an HTML <table> where each <tr>
// is one title. Because the exact class names shift over time and are locale
// specific, the parser uses tolerant, layered selectors + header-driven column
// detection rather than hardcoded positions, and degrades gracefully with
// warnings instead of throwing on a single bad row.

import {
  ImportParseError,
  type ImportEntry,
  type ImportParseResult,
  type ImportStatus,
  type ImportMediaType,
} from "./import-schema";

// Nautiljon (French) status labels -> neutral status.
const STATUS_MAP: Record<string, ImportStatus> = {
  "en cours": "watching",
  "en cours de visionnage": "watching",
  "à voir": "planned",
  "a voir": "planned",
  planifié: "planned",
  planifie: "planned",
  terminé: "completed",
  termine: "completed",
  fini: "completed",
  "en pause": "paused",
  "en attente": "paused",
  abandonné: "dropped",
  abandonne: "dropped",
  "laissé tomber": "dropped",
};

function normalizeStatus(raw: string): ImportStatus {
  const k = raw.trim().toLowerCase();
  return STATUS_MAP[k] ?? "unknown";
}

// Nautiljon type hints -> neutral media type.
function normalizeType(raw: string): ImportMediaType {
  const k = raw.trim().toLowerCase();
  if (k.includes("film") || k.includes("movie")) return "movie";
  if (k.includes("série tv") || k.includes("serie tv") || k.includes("tv")) return "anime";
  if (k.includes("oav") || k.includes("ova") || k.includes("ona")) return "anime";
  if (k.includes("manga") || k.includes("scan")) return "manga";
  if (k.includes("anime")) return "anime";
  return "unknown";
}

function cleanText(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function parseIntSafe(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.replace(/\u00a0/g, " ").match(/-?\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function parseYear(s: string | null | undefined): number | null {
  const n = parseIntSafe(s);
  if (n && n >= 1900 && n <= 2100) return n;
  return null;
}

// Nautiljon scores are typically /10 already; keep tolerant to /20 sources.
function parseScore(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.replace(",", ".").match(/\d+(\.\d+)?/);
  if (!m) return null;
  let v = parseFloat(m[0]);
  if (Number.isNaN(v)) return null;
  if (v > 10) v = v / 2; // normalize a /20 scale to /10
  return Math.round(v * 10) / 10;
}

function toIsoDate(s: string | null | undefined): string | null {
  const t = cleanText(s);
  if (!t) return null;
  // dd/mm/yyyy
  let m = t.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // yyyy-mm-dd already
  m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

// Extract a numeric Nautiljon id from a URL like /animes/12345/naruto.html
function providerIdFromUrl(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/\/(\d{2,})[\/-]/) || url.match(/\/(\d{2,})\.html/);
  return m ? m[1] : null;
}

// Map a normalized header label to a logical column.
type ColKey =
  | "title"
  | "type"
  | "year"
  | "episodes"
  | "status"
  | "score"
  | "progress"
  | "started"
  | "completed";

function classifyHeader(label: string): ColKey | null {
  const k = label.toLowerCase();
  if (k.includes("titre") || k.includes("nom") || k.includes("title")) return "title";
  if (k.includes("type") || k.includes("format")) return "type";
  if (k.includes("année") || k.includes("annee") || k.includes("year")) return "year";
  if (k.includes("épisodes") || k.includes("episodes") || k.includes("nb ép")) return "episodes";
  if (k.includes("statut") || k.includes("status") || k.includes("état")) return "status";
  if (k.includes("note") || k.includes("score")) return "score";
  if (k.includes("progression") || k.includes("vu") || k.includes("avancement")) return "progress";
  if (k.includes("début") || k.includes("debut") || k.includes("commenc")) return "started";
  if (k.includes("fin") || k.includes("terminé le") || k.includes("fini")) return "completed";
  return null;
}

function getDocument(html: string): Document {
  if (typeof DOMParser === "undefined") {
    throw new ImportParseError(
      "DOMParser indisponible dans cet environnement (le parser tourne côté navigateur uniquement).",
      "PARSER_UNAVAILABLE",
    );
  }
  return new DOMParser().parseFromString(html, "text/html");
}

/** Detect pagination hints without following any link. */
function detectPagination(doc: Document): ImportParseResult["pagination"] {
  const text = cleanText(doc.body?.textContent ?? "");
  let currentPage: number | null = null;
  let totalPages: number | null = null;
  let totalItems: number | null = null;

  const pageMatch = text.match(/page\s+(\d+)\s*(?:\/|sur|of)\s*(\d+)/i);
  if (pageMatch) {
    currentPage = parseInt(pageMatch[1], 10);
    totalPages = parseInt(pageMatch[2], 10);
  }
  const totalMatch = text.match(/(\d+)\s+(?:anime|titres|résultats|resultats|entrées|entrees|items)/i);
  if (totalMatch) totalItems = parseInt(totalMatch[1], 10);

  return {
    currentPage,
    totalPages,
    totalItems,
    hasMore: currentPage != null && totalPages != null ? currentPage < totalPages : false,
  };
}

/**
 * Parse a saved Nautiljon list page (HTML string) into neutral entries.
 * Pure: no network, no storage, no side effects.
 */
export function parseNautiljonList(html: string): ImportParseResult {
  if (!html || !html.trim()) {
    throw new ImportParseError("Contenu HTML vide.", "EMPTY_INPUT");
  }
  const doc = getDocument(html);
  const warnings: string[] = [];
  const importedAt = new Date().toISOString();

  // Find the largest table that looks like a list (has rows with links).
  const tables = Array.from(doc.querySelectorAll("table"));
  const listTable = tables
    .map((t) => ({ t, rows: t.querySelectorAll("tr").length }))
    .filter((x) => x.rows > 1)
    .sort((a, b) => b.rows - a.rows)[0]?.t;

  if (!listTable) {
    throw new ImportParseError(
      "Aucun tableau de liste reconnu dans la page.",
      "NO_LIST_FOUND",
    );
  }

  // Build column index from the header row when present.
  const headerCells = Array.from(
    listTable.querySelectorAll("thead th, thead td, tr:first-child th"),
  );
  const colIndex = new Map<ColKey, number>();
  headerCells.forEach((cell, i) => {
    const key = classifyHeader(cleanText(cell.textContent));
    if (key && !colIndex.has(key)) colIndex.set(key, i);
  });

  const bodyRows = Array.from(
    listTable.querySelectorAll("tbody tr"),
  ).length
    ? Array.from(listTable.querySelectorAll("tbody tr"))
    : Array.from(listTable.querySelectorAll("tr")).slice(headerCells.length ? 1 : 0);

  const entries: ImportEntry[] = [];

  for (const [rowIdx, row] of bodyRows.entries()) {
    const cells = Array.from(row.querySelectorAll("td"));
    if (cells.length === 0) continue;

    const cellAt = (k: ColKey): string =>
      colIndex.has(k) ? cleanText(cells[colIndex.get(k)!]?.textContent) : "";

    // Title + link: prefer a header-mapped title cell, else first anchor.
    const titleCell = colIndex.has("title") ? cells[colIndex.get("title")!] : cells[0];
    const anchor = (titleCell ?? row).querySelector("a[href]") as HTMLAnchorElement | null;
    const title = cleanText(anchor?.textContent) || cellAt("title") || cleanText(titleCell?.textContent);

    if (!title) {
      warnings.push(`Ligne ${rowIdx + 1} ignorée : titre introuvable.`);
      continue;
    }

    const providerUrl = anchor?.getAttribute("href")
      ? new URL(anchor.getAttribute("href")!, "https://www.nautiljon.com").href
      : null;

    // Alt titles: other anchors / italic subtitles inside the title cell.
    const altTitles = Array.from(titleCell?.querySelectorAll("i, .sous_titre, small") ?? [])
      .map((n) => cleanText(n.textContent))
      .filter((t) => t && t !== title);

    // Progress like "5/12" -> progress 5, episodes 12.
    const progRaw = cellAt("progress");
    const progMatch = progRaw.match(/(\d+)\s*\/\s*(\d+)/);
    const progress = progMatch ? parseInt(progMatch[1], 10) : parseIntSafe(progRaw);
    const episodesFromProgress = progMatch ? parseInt(progMatch[2], 10) : null;

    entries.push({
      provider: "nautiljon",
      providerUrl,
      providerId: providerIdFromUrl(providerUrl),
      title,
      altTitles,
      mediaType: normalizeType(cellAt("type")),
      releaseYear: parseYear(cellAt("year")),
      totalEpisodes: parseIntSafe(cellAt("episodes")) ?? episodesFromProgress,
      status: normalizeStatus(cellAt("status")),
      score: parseScore(cellAt("score")),
      progress,
      startedAt: toIsoDate(cellAt("started")),
      completedAt: toIsoDate(cellAt("completed")),
      importedAt,
    });
  }

  if (entries.length === 0) {
    warnings.push("Tableau détecté mais aucune ligne exploitable.");
  }

  return {
    provider: "nautiljon",
    entries,
    pagination: detectPagination(doc),
    warnings,
  };
}
