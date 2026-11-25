# Sig — Changes & Backlog

Working notes for **Subspace Hail & Signature Studio** (`sig.the-lal.net`).
Everything under "Done" is committed and pushed to `origin/main`.
Everything under "Backlog" is not done yet — pick items off that list later.

Repo: <https://github.com/oldcode5791/sig>

---

## Done (pushed)

### 1. Faithful preview — `76c4205`
The compiled signature was injected into the app's own DOM, so Tailwind's
preflight resets (`img{display:block;max-width:100%}`, link/heading resets)
distorted it and the preview didn't match real email clients.

- Render the signature in a sandboxed `<iframe srcDoc>` with its own document.
- Auto-size the frame via a `postMessage` height report (parent validates
  `event.source === iframe.contentWindow`).
- Light/dark canvas background now lives inside the frame.
- Preview reuses `compiledHtml` when the blocked-image simulation is off, so the
  signature is no longer compiled twice per keystroke.

### 2. Embedded-image warnings + real size limit — `6cdf512`
- Replaced the misleading 90 KB "Gmail clip" heuristic with the actual
  ~10,000-character Gmail **signature box** limit.
- Detect base64 `data:` images and show a persistent inline warning, a title-bar
  notice, and an updated upload toast (Gmail/Outlook strip embedded images).
- Size readout now shows characters as the primary stat, with KB in the tooltip.

### 3. Robustness fixes — `61c0fce`
- **Toast timers** coalesced via a `useRef`; an old banner can no longer dismiss a
  newer one, and the timer is cleared on unmount.
- **`handleCopyRawHtml`** wrapped in `try/catch` with a failure toast.
- **Image upload**: `reader.onerror` / `img.onerror` / null-context handling;
  alpha-capable formats (PNG/WebP/GIF) stay PNG, others are flattened onto white
  instead of going black through JPEG.
- **Presets**: written explicitly on save/delete with quota errors surfaced via
  toast; stored data validated on load instead of trusting `JSON.parse`.
- **Plain-text clipboard fallback** built from non-empty fields only (no dangling
  separators).
- **Reset Default** now asks for confirmation.

### 4. Outlook-safe output + export encoding — `ccf6287`
- Social badges are now `bgcolor` table cells (Outlook's Word engine ignores
  `border-radius`/`padding` on inline-block anchors).
- Image `src` normalised/validated (`https://` or `data:image/` only) so a
  scheme-less URL can't resolve to a broken relative path.
- `tel:` links only emitted for values with a plausible number of digits (≥7), so
  "Subspace Channel 04" is plain text.
- Downloaded/copied output wrapped in a full HTML document with `<meta charset>`
  (fixes mojibake for em dashes and other non-ASCII text).
- Stopped escaping apostrophes in double-quoted attributes (fixes the
  `'Trebuchet MS'` font stack).
- Added editable **Tax ID label** and **Banner alt text** fields.
- Shared `AVATAR_MIN_WIDTH` / `AVATAR_MAX_WIDTH` constants so the slider, tooltip
  and compiler agree.
- Softened "never breaks in Outlook" copy to match real behaviour.

### 5. Comment cleanup — `17812de`, `2afebe6`
- Removed a stale phone-link comment and trimmed ~24 redundant comments that only
  restated the next line. Kept why-comments, JSDoc and region markers.
- Verified comments-only: production JS hash unchanged.

---

## Verification performed
- `npm run build` (`tsc -b && vite build`) and `npm run lint` (oxlint) pass on the
  final tree.
- The pure compiler was exercised through a throwaway Node harness to confirm:
  apostrophes preserved, badge cell markup emitted, image `src` upgraded to
  `https://`, banner alt applied, tax label used, em dashes intact,
  `<meta charset>` present, non-numeric phone left unlinked, and blocked-image
  placeholders correct.

---

## Backlog (not done)

### A. Accessibility
- [ ] Tie `<label htmlFor>` to inputs via `useId` (InputField, ColorField, font
      select, slider).
- [ ] `role="tab"` / `aria-selected` on tabs; `aria-pressed` on toggles.
- [ ] `role="status"` / `aria-live="polite"` on the toast.
- [ ] File inputs: `sr-only` + `focus-within` ring instead of `display:none`, so
      they are keyboard reachable.
- [ ] Remove duplicate tooltips (controls currently have both `title` and
      `InfoTooltip`); keep one.
- [ ] Fix `w-60` tooltip overflow on narrow screens; raise low-contrast
      `text-slate-500` (e.g. the × delete button).

### B. Structure & tests
- [ ] Split `App.tsx` (~960 lines) into `components/` (IdentityTab, BrandingTab,
      ExtrasTab, PresetManager, PreviewPane, ExportBar, fields) + hooks
      (`useToast`, `useImageUpload`, `useLocalStorage`).
- [ ] Make the repetitive `InputField` blocks data-driven from config arrays.
- [ ] Export `App` one way only (named vs default); `import type { ChangeEvent }`.
- [ ] Add Vitest tests for `signatureCompiler`: escaping, empty-field omission,
      each layout, URL normalisation, blocked-image mode.

### C. Config & housekeeping
- [ ] `tsconfig.app.json`: add `"strict": true` (consider
      `noUncheckedIndexedAccess`).
- [ ] Remove unused `@cloudflare/vite-plugin`, or wire it into `vite.config.ts`.
- [ ] Delete template leftovers: empty `src/App.css`, unreferenced
      `src/assets/*`, `public/icons.svg`.
- [ ] Rewrite `README.md` (what it does, dev/build/deploy, privacy positioning).
- [ ] `.oxlintrc.json`: add `jsx-a11y` + `correctness`; add `typecheck` / `test`
      scripts to `package.json`.
- [ ] `index.html`: PNG `og:image` (1200×630), `twitter:title` / `twitter:image`,
      `theme-color`, `<noscript>`.

### D. Nice-to-have features (raised during review)
- [ ] Draft autosave (refresh currently loses unsaved edits).
- [ ] Debounce / `useDeferredValue` the preview when a large base64 image is
      embedded.
- [ ] Editable alt text / label polish already partly done — review remaining
      hard-coded strings (e.g. brand URLs) into a single `config.ts` if reused.

---

## Decisions on record
- Scope chosen: **Commits 1–4** plus the standalone comment cleanup.
- Cadence: **one commit per group**, pushed to `origin/main`.
- Out-of-scope for now: the `App.tsx` component split, Vitest coverage, and
  config/housekeeping (Backlog B and C).
