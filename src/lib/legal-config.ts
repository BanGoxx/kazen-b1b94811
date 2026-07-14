/**
 * KAZEN — Legal placeholders (Phase 26.2).
 *
 * These constants are INTERNAL markers. Every value tagged with `__MISSING__`
 * is a bloquant that requires an owner decision + professional validation
 * (avocat / DPO / expert PI) before the corresponding legal page can be
 * declared final. The UI surfaces them literally inside a visible
 * "Brouillon" banner so nothing looks legally binding by accident.
 *
 * DO NOT invent values here. If a value is unknown, keep the __MISSING__
 * sentinel — the page will render as an obvious draft.
 */

export const LEGAL_DRAFT = true as const;

/** Human-visible sentinel used inside the drafts. */
export const MISSING = "[À COMPLÉTER — décision propriétaire requise]" as const;

export const LEGAL = {
  // C1 — Identité éditeur
  publisherName: MISSING,
  publisherStatus: MISSING, // ex: micro-entreprise, SAS, personne physique…
  publisherAddress: MISSING,
  publisherEmail: MISSING,
  publisherRegistration: MISSING, // SIREN/SIRET si applicable
  publicationDirector: MISSING,

  // C1 — Hébergeur
  hostName: "Lovable / Supabase (fournisseurs techniques) — [entité contractuelle à confirmer]",
  hostAddress: MISSING,
  hostContact: MISSING,

  // C6 — LCEN
  lcenContact: MISSING,

  // C2 — RGPD
  dpoContact: MISSING,

  // C7 — Mineurs
  minimumAge: MISSING, // décision propriétaire (ex: 13, 15, 16)

  // Droit applicable
  governingLaw: MISSING,
  jurisdiction: MISSING,

  // Version & date des documents
  version: "0.1-draft",
  lastUpdated: "2026-07-14",
} as const;

export type LegalConfig = typeof LEGAL;
