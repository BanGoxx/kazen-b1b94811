# Phase 9 — Search and Add KAZEN Titles

## Goal
Let members search the full KAZEN catalogue (anime, films, séries) directly from list/playlist editing flows and add titles, with jacket, media type, year, existing-list state, and a direct fiche link — without leaving the list.

## Current state (audit)
- Add-to-playlist today is **reverse**: you must be on a title fiche and use `AddToPlaylist.tsx`. There is no way to sit inside a playlist and search the catalogue to add titles.
- Playlist add mutation already exists: `usePlaylistMutations().n` (`addItem`) in `src/lib/playlists.ts` (snapshots media into `media_records`, inserts into `playlist_items`, dedupes on duplicate). `removeItem` also exists.
- Personal list add already exists via `ListControls` / `use-list.tsx`.
- Search is already server-backed and reusable: `searchMedia` and `searchMediaPaged` (`src/lib/discover.functions.ts`), wired through `searchMediaQO` / `searchMediaInfiniteQO` (`src/lib/queries.ts`). AniList + TMDB, already deduped and normalized to `MediaItem`.
- Playlist edit surface: `src/routes/_authenticated/mes-playlists.tsx` (owner). Playlist detail: `src/routes/playlist.$id.tsx`.

No new capability is missing — this is a UI composition over existing search + add mutations. **No migration, no schema change, no new secret, no external provider.**

## What will be built

### 1. New component: `src/components/media/CatalogSearchPicker.tsx`
A compact, reusable, premium picker (matching graphite/crimson DA):
- Debounced search input (~300 ms) driving `searchMediaInfiniteQO(q)` (bounded pagination, "Charger plus", no full-catalogue download).
- Result rows: jacket (via `SafeImage`, safe missing-poster fallback), title + alt title, media-type badge (Anime/Série/Film from normalized `mediaType`, never inferred from text), year when available.
- Each row: an "Ajouter" action + a fiche link (`/media/$source/$id`) opening in the same internal routing. No raw IDs shown.
- "Existing-list state": rows already present show a checked/"Ajouté" state instead of the add button.
- Props keep it surface-agnostic: `onAdd(item)`, `isAdded(item) => boolean`, `pending` set. So it drives either playlist `addItem` or personal-list add.

### 2. Wire into playlist editing — `mes-playlists.tsx` (and/or `playlist.$id.tsx` owner view)
- Add an "Ajouter des titres" trigger (Dialog/inline panel) inside the owner edit flow, using the existing `usePlaylistMutations().n` mutation.
- `isAdded` derived from the loaded playlist items (`media_key`); prevents duplicate title in the same list (existing dedupe already enforces this server-side).
- Preserve all current manual add/remove/reorder/edit capabilities untouched.

### 3. Wire into personal list ("Ma liste") — optional same picker
- Reuse `CatalogSearchPicker` with `onAdd` calling the existing list upsert (through `use-list` mutations + `applyTrackingRules` from Phase 5, so a freshly-added title still respects tracking defaults).
- Only if the current "Ma liste" surface has a natural add entry point; otherwise limit Phase 9 to playlists and note it.

## Constraints honored
- Debounced + bounded pagination; no client-side full catalogue.
- Media type from normalized `MediaItem.mediaType` only.
- List privacy / ownership RLS unchanged — reuses existing owner-scoped mutations.
- No DA change, no card-proportion change, no route/table/API rename.
- No duplicate titles unless product already allows it (it does not).

## Technical notes
- Reuse `searchMediaInfiniteQO`, `SafeImage`, `MediaCard`/badge tokens, `usePlaylistMutations`, `useListMutations`.
- New file only: `CatalogSearchPicker.tsx`; edits: `mes-playlists.tsx` (and possibly `playlist.$id.tsx`, `mes-listes.tsx`).
- No `createServerFn` changes needed; search fns already exist and are SSR-safe with the browser-fallback pattern in `queries.ts`.

## QA matrix
- Empty query / short query (no fetch) / no results state.
- Anime, film, série each returned with correct badge + year + jacket + fallback poster.
- Add a title → appears in playlist; row flips to "Ajouté"; re-adding blocked (dedupe).
- Fiche link navigates correctly and back.
- Load-more pagination; rapid typing debounce; no infinite spinner.
- Ownership/RLS: non-owner cannot add; private playlist stays private.
- Personal-list add (if in scope) applies Phase 5 tracking defaults.
- Mobile/desktop; dark/light; keyboard/focus/ARIA on input, rows, add buttons.
- Regression: existing `AddToPlaylist` fiche flow, remove, reorder, scroll restoration, cache all intact.
- Full project typecheck.

## Out of scope / stop conditions
- No new table, migration, secret, provider, or email/delivery activation.
- No automatic publish. Manual publication required after PASS.

Approve this and I'll implement Phase 9, run the QA matrix + typecheck, and return a PASS/PARTIAL/BLOCKED verdict without publishing.