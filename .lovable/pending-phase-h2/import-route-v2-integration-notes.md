# Integration notes — `src/routes/_authenticated/import.tsx`

## Base

Patch is generated against the commit where `import.tsx` was still V1-only
in staging (last V1-only commit: `689150c` — initial import from remix).
Production's `import.tsx` almost certainly diverges from this base.

**Do not apply blindly.** The staging file (`reference/src/routes/_authenticated/import.tsx`)
is a merge reference, not a drop-in replacement.

## Mandatory hunks (V2 correctness)

1. **Imports**
   ```ts
   import { isCanonicalImportV2Enabled } from "@/lib/import-canonical-v2.functions";
   import { CanonicalV2Import } from "@/components/import/CanonicalV2Import";
   ```
2. **Server gate wiring**
   ```ts
   const checkV2 = useServerFn(isCanonicalImportV2Enabled);
   const [v2Enabled, setV2Enabled] = useState(false);
   ```
3. **Fail-closed effect** (right next to `refreshBatches()`):
   ```ts
   void checkV2()
     .then((r) => setV2Enabled(Boolean(r?.enabled)))
     .catch(() => setV2Enabled(false));
   ```
   The gate MUST come from the server function. Do not read `localStorage`,
   query strings, cookies, or any client-side flag to decide V1/V2.
4. **Conditional render** — replace the AniList branch of the Upload section:
   ```tsx
   {selected && v2Enabled && selected === "anilist" ? (
     <div data-testid="canonical-v2-panel"><CanonicalV2Import /></div>
   ) : (
     selected && (
       <div data-testid="legacy-v1-upload">
         <UploadSection ... />
       </div>
     )
   )}
   ```
   V2 is enabled ONLY for the `anilist` provider. All other providers must
   continue to render the legacy V1 `UploadSection`.

## Optional hunks (test surface)

- `data-testid="provider-<id>"` on each provider button — used by Playwright.
- `data-testid="canonical-v2-panel"` / `data-testid="legacy-v1-upload"` —
  used by staging harness; keep to preserve E2E parity if a future QA
  harness is authored.

## Probable conflict points

- Import block ordering (production may have reordered imports).
- `useEffect` list at mount (production may already run multiple effects).
- Layout of the Upload section if production has added extra providers or
  visual polish.

Resolve by hand; keep all V1 behavior for non-AniList providers.

## V1 elements that MUST be preserved

- All existing `PROVIDERS` entries.
- `UploadSection` usage for every provider ≠ `anilist` OR when `v2Enabled === false`.
- Preview / confirm / rollback flow for V1 batches.
- Export section.
- Existing `refreshBatches()` behavior.

## Post-merge verification

- `bunx tsgo --noEmit` — 0 errors.
- `bunx vitest run` — all tests pass, including new V2 tests.
- `bun run build` — success.
- With `IMPORT_CANONICALIZATION_V2.enabled = false` (or user not in
  `allowed_user_ids`), the AniList branch must render the legacy
  `UploadSection`, not `CanonicalV2Import`. Verify with a signed-in test
  account.
- Bundle audit: `dist/client` must not contain any `.server.ts` code or
  `SUPABASE_SERVICE_ROLE_KEY` string.

## Fail-closed guarantee

If `isCanonicalImportV2Enabled()` throws or returns anything other than
`{ enabled: true }` for the current user, the UI MUST stay on V1. This is
enforced by the `.catch(() => setV2Enabled(false))` above. Do not remove.
