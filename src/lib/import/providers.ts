// KAZEN — Provider-agnostic import registry.
//
// Every provider exposes the SAME normalized output: ImportEntry[]. Only a
// subset is functional in Phase 1; the rest are declared as "coming later" and
// never fake support. No provider fetches, crawls, or authenticates against a
// third-party site: parsers only read content the user themselves supplies
// (a saved file / pasted text). Nautiljon is intentionally limited to
// user-provided saved HTML — no scraping, no extension, no bookmarklet yet.

import {
  ImportParseError,
  type ImportEntry,
  type ImportProvider,
  type ImportStatus,
  type ImportMediaType,
} from "./import-schema";
import { parseNautiljonList } from "./nautiljon-parser";
import { parseMalXml } from "./mal-parser";

export type ProviderId = ImportProvider | "kazen_csv" | "kazen_json";

export interface ProviderDef {
  id: ProviderId;
  label: string;
  /** Short French description shown in the picker. */
  description: string;
  /** Whether the parser is functional in this phase. */
  available: boolean;
  /** Functional but not yet fully validated (shown with an "Expérimental" tag). */
  experimental?: boolean;
  /** Import by public username via a live provider fetch (no file upload). */
  usernameBased?: boolean;
  /** Extra reassurance lines shown near the upload zone (privacy, scope…). */
  notes?: string[];
  /** Accepted file extensions / mime hint for the upload input. */
  accept: string;
  /** How the user obtains the file (French, user-initiated only). */
  howto: string;
  /** Parse user-provided text content into neutral entries. */
  parse: (content: string) => ImportEntry[];
}

function comingLater(id: string): (content: string) => ImportEntry[] {
  return () => {
    throw new ImportParseError(
      `L'import ${id} sera disponible prochainement.`,
      "PARSER_UNAVAILABLE",
    );
  };
}

const importedAt = () => new Date().toISOString();

// ---------- KAZEN CSV parser ----------
// Simple, forgiving CSV: header row with any of the known column names.
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const STATUS_ALIASES: Record<string, ImportStatus> = {
  planned: "planned",
  "plan to watch": "planned",
  "a voir": "planned",
  "à voir": "planned",
  watching: "watching",
  "en cours": "watching",
  current: "watching",
  completed: "completed",
  terminé: "completed",
  termine: "completed",
  paused: "paused",
  "on hold": "paused",
  "en pause": "paused",
  dropped: "dropped",
  abandonné: "dropped",
  abandonne: "dropped",
};

function normStatus(raw: string): ImportStatus {
  return STATUS_ALIASES[raw.trim().toLowerCase()] ?? "unknown";
}

function normType(raw: string): ImportMediaType {
  const k = raw.trim().toLowerCase();
  if (!k) return "unknown";
  if (k.includes("movie") || k.includes("film")) return "movie";
  if (k.includes("anime") || k.includes("ova") || k.includes("ona")) return "anime";
  if (k.includes("manga")) return "manga";
  if (k.includes("serie") || k.includes("série") || k.includes("tv") || k.includes("show"))
    return "series";
  return "unknown";
}

function numOrNull(s: string | undefined): number | null {
  if (!s) return null;
  const n = parseFloat(s.replace(",", "."));
  return Number.isNaN(n) ? null : n;
}
function intOrNull(s: string | undefined): number | null {
  const n = numOrNull(s);
  return n == null ? null : Math.round(n);
}

function parseKazenCsv(content: string): ImportEntry[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    throw new ImportParseError("Fichier CSV vide ou sans données.", "EMPTY_INPUT");
  }
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idx = (names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));
  const cTitle = idx(["title", "titre", "nom"]);
  const cType = idx(["type", "format"]);
  const cYear = idx(["year", "année", "annee"]);
  const cEp = idx(["episodes", "épisodes", "total"]);
  const cStatus = idx(["status", "statut", "état"]);
  const cScore = idx(["score", "note", "rating"]);
  const cProg = idx(["progress", "progression", "vu"]);
  const cStart = idx(["start", "début", "debut"]);
  const cDone = idx(["completed", "fin", "terminé le"]);
  const cNotes = idx(["notes", "comment"]);
  if (cTitle < 0) {
    throw new ImportParseError("Colonne titre introuvable dans le CSV.", "UNSUPPORTED_DOCUMENT");
  }
  const now = importedAt();
  const entries: ImportEntry[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const title = (cells[cTitle] ?? "").trim();
    if (!title) continue;
    entries.push({
      provider: "nautiljon", // placeholder; overwritten by caller's provider id
      providerUrl: null,
      providerId: null,
      title,
      altTitles: [],
      mediaType: cType >= 0 ? normType(cells[cType]) : "unknown",
      releaseYear: cYear >= 0 ? intOrNull(cells[cYear]) : null,
      totalEpisodes: cEp >= 0 ? intOrNull(cells[cEp]) : null,
      status: cStatus >= 0 ? normStatus(cells[cStatus]) : "unknown",
      score: cScore >= 0 ? numOrNull(cells[cScore]) : null,
      progress: cProg >= 0 ? intOrNull(cells[cProg]) : null,
      startedAt: cStart >= 0 && cells[cStart] ? cells[cStart].slice(0, 10) : null,
      completedAt: cDone >= 0 && cells[cDone] ? cells[cDone].slice(0, 10) : null,
      importedAt: now,
    });
  }
  if (entries.length === 0) {
    throw new ImportParseError("Aucune ligne exploitable dans le CSV.", "NO_LIST_FOUND");
  }
  return entries;
}

// ---------- KAZEN JSON parser ----------
// Accepts either a bare array of entries or { entries: [...] }.
function parseKazenJson(content: string): ImportEntry[] {
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    throw new ImportParseError("JSON invalide.", "UNSUPPORTED_DOCUMENT");
  }
  const arr: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray((data as { entries?: unknown[] })?.entries)
      ? (data as { entries: unknown[] }).entries
      : [];
  if (arr.length === 0) {
    throw new ImportParseError("Aucune entrée dans le JSON.", "NO_LIST_FOUND");
  }
  const now = importedAt();
  const entries: ImportEntry[] = [];
  for (const raw of arr) {
    const r = raw as Record<string, unknown>;
    const title = String(r.title ?? r.titre ?? r.name ?? "").trim();
    if (!title) continue;
    const started = r.startedAt ?? r.started_at;
    const completed = r.completedAt ?? r.completed_at;
    const scoreVal = r.score ?? r.rating;
    const rewatch = r.rewatchCount ?? r.rewatch_count;
    const rewatching = r.isRewatching ?? r.is_rewatching;
    const tags = Array.isArray(r.userTags)
      ? (r.userTags as string[])
      : Array.isArray(r.tags)
        ? (r.tags as string[])
        : [];
    const altTitles = Array.isArray(r.altTitles)
      ? (r.altTitles as string[])
      : r.original_title
        ? [String(r.original_title)]
        : [];
    entries.push({
      provider: "nautiljon",
      providerUrl: (r.url as string) ?? (r.import_ref as string) ?? null,
      providerId: r.id != null ? String(r.id) : null,
      title,
      altTitles,
      mediaType: normType(String(r.mediaType ?? r.type ?? "")),
      releaseYear: intOrNull(
        r.releaseYear != null ? String(r.releaseYear) : r.year != null ? String(r.year) : undefined,
      ),
      totalEpisodes: intOrNull(r.totalEpisodes != null ? String(r.totalEpisodes) : undefined),
      status: normStatus(String(r.status ?? "")),
      score: numOrNull(scoreVal != null ? String(scoreVal) : undefined),
      progress: intOrNull(r.progress != null ? String(r.progress) : undefined),
      startedAt: started ? String(started).slice(0, 10) : null,
      completedAt: completed ? String(completed).slice(0, 10) : null,
      comments: r.notes != null ? String(r.notes) : (r.comments as string) ?? null,
      userTags: tags,
      rewatchCount: intOrNull(rewatch != null ? String(rewatch) : undefined),
      isRewatching: Boolean(rewatching),
      importedAt: now,
    });
  }
  if (entries.length === 0) {
    throw new ImportParseError("Aucune entrée exploitable dans le JSON.", "NO_LIST_FOUND");
  }
  return entries;
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: "kazen_csv",
    label: "KAZEN CSV",
    description: "Réimporte une liste exportée depuis KAZEN (CSV).",
    available: true,
    accept: ".csv,text/csv",
    howto: "Téléverse un fichier CSV (colonnes titre, statut, note, progression…).",
    parse: parseKazenCsv,
  },
  {
    id: "kazen_json",
    label: "KAZEN JSON",
    description: "Réimporte une liste exportée depuis KAZEN (JSON).",
    available: true,
    accept: ".json,application/json",
    howto: "Téléverse un fichier JSON (tableau d'entrées ou objet { entries }).",
    parse: parseKazenJson,
  },
  {
    id: "nautiljon",
    label: "Nautiljon",
    description: "Importer depuis un fichier HTML sauvegardé de ta liste Nautiljon.",
    available: true,
    experimental: true,
    accept: ".html,.htm,text/html",
    howto:
      "Ouvre ta liste Nautiljon dans ton navigateur, enregistre la page (Ctrl+S) puis téléverse le fichier HTML obtenu.",
    notes: [
      "Aucun mot de passe Nautiljon n'est demandé.",
      "Aucun cookie n'est transmis.",
      "Seules les données visibles dans votre fichier sont analysées.",
    ],
    parse: (content) => parseNautiljonList(content).entries,
  },
  {
    id: "myanimelist",
    label: "MyAnimeList",
    description: "Importer un export XML MyAnimeList de ta liste d'anime.",
    available: true,
    experimental: true,
    accept: ".xml,text/xml",
    howto:
      "Sur MyAnimeList : Profil → List → Export (ou myanimelist.net/panel.php?go=export), choisis « Anime List », télécharge puis décompresse le fichier .gz pour obtenir le .xml, et téléverse-le ici.",
    notes: [
      "Aucun identifiant MyAnimeList n'est demandé.",
      "Aucun cookie ni jeton de session n'est transmis.",
      "Aucune synchronisation automatique : tu importes uniquement le fichier que tu fournis.",
      "Vérifiez les correspondances avant confirmation : rien n'est écrit dans ta liste sans ton accord.",
      "Champs pris en charge : titre, ID MAL, type, épisodes, épisodes vus, statut, note, dates de début/fin, tags, commentaires, visionnages.",
      "Limites : seules les listes d'anime sont gérées (pas les mangas) ; la progression, les dates et les visionnages sont conservés dans l'aperçu mais pas encore appliqués à ta liste.",
    ],
    parse: (content) => parseMalXml(content).entries,
  },

  {
    id: "anilist",
    label: "AniList",
    description: "Importer ta liste d'anime publique AniList via ton nom d'utilisateur.",
    available: true,
    experimental: true,
    usernameBased: true,
    accept: "",
    howto:
      "Saisis ton nom d'utilisateur AniList (celui de l'URL anilist.co/user/…). Ton profil doit être public. KAZEN lit uniquement ta liste d'anime, sans mot de passe ni connexion.",
    notes: [
      "Aucun mot de passe ni connexion AniList n'est demandé.",
      "Seule ta liste d'anime publique est lue (aucun manga, aucun contenu privé).",
      "Aucune synchronisation automatique : tu déclenches toi-même l'import.",
      "Champs pris en charge : titre, statut, note, progression, dates, visionnages (repeat).",
      "Vérifie les correspondances avant de confirmer : rien n'est écrit sans ton accord.",
    ],
    parse: comingLater("anilist"),
  },
  {
    id: "anime-planet",
    label: "Anime-Planet",
    description: "Import depuis un export Anime-Planet.",
    available: false,
    accept: ".csv,.json",
    howto: "Bientôt disponible.",
    parse: comingLater("anime-planet"),
  },
  {
    id: "simkl",
    label: "Simkl",
    description: "Import depuis un export Simkl.",
    available: false,
    accept: ".json,application/json",
    howto: "Bientôt disponible.",
    parse: comingLater("simkl"),
  },
];

/** DB provider slug for a picker provider id. */
export function toDbProvider(id: ProviderId): string {
  if (id === "myanimelist") return "mal";
  if (id === "anime-planet") return "anime_planet";
  return id;
}

export function getProvider(id: ProviderId): ProviderDef | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
