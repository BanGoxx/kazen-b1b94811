# Spike — Import Nautiljon → KAZEN (discovery only)

Prototype, no production feature, no publish, no migration applied.

## Prototype files (additive, isolated, not wired into any route)
- `src/lib/import/import-schema.ts` — neutral provider-independent schema + KAZEN mappers.
- `src/lib/import/nautiljon-parser.ts` — dev-only HTML-string parser (no network).
- `src/lib/import/match.ts` — matching + confidence scoring (pure functions).

## KAZEN data model (as inspected, unchanged)
- `list_items(user_id, media_key→media_records, status watch_status, favorite bool,
  priority priority_level, rating smallint 1..10, notes, tags[])`
  - Dedup: `UNIQUE(user_id, media_key)`; write via `onConflict(user_id,media_key)`.
  - Statuses: `a_voir | en_cours | termine | en_pause | abandonne`.
  - **No episode-progress column. No start/completion date columns.**
- `media_records(media_key PK = "source:externalId", source, external_id,
  media_type, title, title_original, release_date text, score, genres[], platforms)`
  - External IDs live inside `media_key` (e.g. `anilist:12345`, `tmdb_tv:1429`).
- Candidate lookup uses existing `anilistSearchPaged(q, page)`.

## Matching signals & thresholds
title (0.7, edit-distance ∪ token-containment) + year (±0/±1) + type + episode count;
external-id shortcut → 0.98. exact ≥ 0.90, probable ≥ 0.70, else unmatched;
duplicate when best match key already in `list_items`.

## Additive changes needed later (NOT applied)
- `list_items.progress smallint` + `started_at date` + `completed_at date` (nullable).
- `import_batches(id, user_id, source, created_at, item_count)` + `list_items.import_batch_id`
  for provenance & rollback.
- No changes to auth or existing RLS/write logic.

## Recommendation: PROCEED WITH RESTRICTIONS (user-triggered local parser first).
