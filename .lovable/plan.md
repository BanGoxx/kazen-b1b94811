# KAZEN Universe — Architecture & Plan (no code changed)

## 1. Current state (audit)

**Already solid**
- **Universe/group**: `src/lib/franchise.ts` builds a `FranchiseGroup` from a fiche's `related[]`, bucketed into `FormatGroup` (anime / manga / novel / music / other), with year + decade filters. Route `/franchise/$source/$id` renders tabs, decade chips, and sections.
- **Related media**: `RelatedMedia` model with `relationCategory` (franchise / adaptation / recommendation / other), `relation` labels (Préquelle, Suite, Spin-off…), `formatGroup`, `year`, `hasDetail`. Grouped + de-duped + ordered in `groupRelated`.
- **Entities**: real KAZEN pages exist — `/entite/$kind/$id` (character/staff) backed by `getEntityProfile` → `anilistCharacter` / `anilistStaff`, with FR-cleaned descriptions, facts, media links, related people. `EntityProfileDialog` acts as fallback overlay.
- **News-ready**: `FicheArticles` renders nothing when empty; `/actualites/$slug` route foundation exists (currently `notFound`).
- **Normalization**: AniList + TMDB → unified `MediaItem`/`MediaDetail`; FR genre mapping; FR/EN synopsis fallback already in place.

**Missing for a full Universe model**
- No **first-class Universe entity** — a group is derived per-fiche from one anime's relations, so siblings can resolve to different anchors and non-anime formats (manga/LN) have no reachable fiche.
- No **dedicated fiche types** beyond anime/series/film — manga, LN, OAV, OST, goodies have no route or model.
- No **category-scoped filtered views** as URLs (filters are local `useState`, not linkable).
- No **persisted news** model — `FicheArticles` has no data source.
- FR/EN summaries are handled ad hoc, not modeled as a `{ fr, en }` field.

## 2. Universe / Group model

**Concept**: a Universe is an addressable anchor, not a per-fiche derivation. Keep the current derivation as the data source, but stabilize the anchor.

- **Route**: keep `/franchise/$source/$id` → alias/redirect to a canonical `/univers/$source/$id` using `deriveGroupAnchor` (already exists) so every sibling resolves to the SAME universe URL.
- **Data**: extend `FranchiseGroup` with counts per category and stable per-item `target` (internal route vs planned route vs external redirect).
- **Categories** (map onto/extend `FormatGroup`): Animes, Mangas, Light novels, OAV/Spécials, Films, OST/CD, Doujinshi, DVD/Blu-ray, Goodies/produits. AniList only supplies anime/manga/LN/music today → the rest degrade gracefully (hidden when empty).
- **UI**: category tabs with counts (`Animes (6)`, `Light novels (3)`), decade/era filter, chronological order. Tabs become URL-driven (see §6).
- **Item linking rule** (already partly in `RelatedScroller`): internal fiche when `hasDetail` → `/media/...` or a future `/oeuvre/$type/...`; else safe external AniList redirect; never a dead link.

```text
/univers/$source/$id
 ├─ header (universe title, backdrop, total count)
 ├─ tabs: Tous | Animes(n) | Mangas(n) | LN(n) | OAV(n) | Films(n) | OST(n) | ...
 ├─ era filter chips
 └─ sections (ordered by year within category)
```

## 3. Dedicated fiche types

Introduce one generic route family `/oeuvre/$type/$source/$id` (type ∈ anime|manga|novel|oav|movie|ost|goods) sharing a common `WorkDetail` base, so anime keeps its rich `/media/...` route and new types reuse layout primitives without a refactor.

Common base (`WorkDetail extends` the useful parts of `MediaDetail`):
- **Required**: title, type, poster, status, French summary (with EN fallback), universe anchor.
- **Optional per type**:
  - manga/LN: auteur, dessinateur, éditeur (VO/VF), volumes, statut de parution, dates.
  - OAV/spécials: rattachement série, durée, date.
  - OST/CD: label, artistes, tracklist, date de sortie.
  - goodies/artbooks/games: type de produit, fabricant/éditeur, date, lien boutique officiel (external only).
- **Data provenance**: anime/manga/LN/OST from AniList; goodies/doujinshi/DVD have no reliable API → curated/manual model, external redirect until a fiche is authored.
- **Summaries**: `Localized = { fr: string | null; en: string | null }`; UI prefers `fr` then `en`; keep raw normalized text so FR can be filled later.
- Every fiche shows a "Fait partie de l'univers …" backlink + related-works rail.

Layout stays premium/editorial (KAZEN section primitives), NOT a Nautiljon table clone.

## 4. Entity pages (characters / staff / authors)

Build on the existing `/entite/$kind/$id`:
- Add `author` handling within `staff` (AniList treats manga authors as Staff) — no new route needed; surface "Œuvres en tant qu'auteur/dessinateur" grouping.
- Core fields (already modeled): name, native name, photo, FR summary, facts, media links, related people.
- **FR strategy**: `Localized` description; show FR when present else EN, with a discreet "traduction à venir" affordance later.
- **Cross-links**: entity → animes (internal `/media`), → manga/LN/OAV/films (future `/oeuvre/...`), → universe anchor. Improves on overlays/external pages by keeping exploration inside KAZEN with consistent DA and SEO.

## 5. Title-specific news / articles

- **Model** (`articles` table, additive): `id, slug, title, body_md, excerpt, lang ('fr'|'en'), cover_url, published_at, source_name, source_url (nullable), title_refs (string[] of media keys), universe_ref (nullable)`.
- **Fiche block**: `FicheArticles` already renders premium cards + hides when empty → feed it the ≤4 most recent articles whose `title_refs` include the fiche key.
- **Detail page**: `/actualites/$slug` renders internal article, FR-first, with backlink to referenced title/universe; external-sourced items redirect out instead.
- **Découverte**: later a small "Actualités" rail sourced from the same table, capped and dismissible — no clutter.
- **Growth path**: start with a tiny curated seed (migration), expand to editorial CMS over time. Never inject generic global news into a specific fiche.

## 6. Navigation / filtering from Universe pages

- Make category tabs **URL-addressable** via search params: `/univers/$source/$id?cat=novel&era=2010s`. Uses TanStack Router `validateSearch`; current local `useState` becomes derived from search → linkable, shareable, SEO-friendly, and back-button safe.
- `Animes (6)` etc. link with `search={{ cat: 'anime' }}`; counts come from the enriched `FranchiseGroup`.
- Progressive + safe: `/franchise/...` stays working; the search-param layer is additive. Only `franchise.ts` gains count fields (pure, no behavior change).

## 7. French-first content & translation

- Introduce `Localized = { fr: string | null; en: string | null }` for all summaries/bios/descriptions in the data model; a single `pickText(loc)` helper (fr → en → null) used everywhere.
- All labels/UI copy remain hard FR (already the case).
- Normalization layer (AniList/TMDB adapters) writes into `Localized` — English lands in `.en`, `.fr` filled from existing FR-genre/synopsis fallback or later manual/AI translation.
- FR/EN text lives in the normalized model, never inline in components → future FR backfill = data change only.

## 8. Incremental implementation steps (additive, independently testable)

- **Step A — Stable Universe route + URL-driven tabs**: alias `/univers/$source/$id`, add per-category counts to `FranchiseGroup`, move filters to search params. No new data source. *(Low risk, pure + presentational.)*
- **Step B — `Localized` text model + `pickText`**: introduce type, thread through adapters with EN in `.en`, keep current fallback behavior. *(Type-level, no UI regression.)*
- **Step C — Generic `/oeuvre/$type/...` fiche + manga/LN fiches**: reuse layout primitives; AniList-backed; internal links from universe when `hasDetail`. *(Additive route.)*
- **Step D — Entity enrichment**: author grouping + cross-links into new `/oeuvre` routes. *(Extends existing route.)*
- **Step E — OST/CD + goodies/doujinshi/DVD**: curated model + external redirect fallback, hidden when empty. *(Additive.)*
- **Step F — News model + article pages**: `articles` table (with GRANTs + public-read RLS), wire `FicheArticles`, render `/actualites/$slug`, seed curated set. *(Additive backend.)*
- **Step G — Découverte editorial rail**: surface recent articles, capped. *(Presentational.)*

Each step avoids touching auth, lists, search, calendar, and current fiches beyond additive wiring.

---

**6. No code was changed and no publish flow was triggered** during this pass — this is analysis/architecture only. A manual publish from your side will be needed only when we start implementing (Steps A+).
