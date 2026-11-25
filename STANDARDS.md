# Coding & Design Standard — the-lal.net projects

The single shared standard for every project under `~/projects`. Copies live in each project root. If a project has its own `AGENTS.md`, `CLAUDE.md`, `PROJECT_SPEC.md` or `README.md` that conflicts with this file, the project file wins.

---

## 1. Core philosophy

- **Zero-server privacy sandbox.** Parsing, image transcoding, PDF work and HTML compilation run in browser memory. No uploads and no telemetry.
- **Everyday-user first.** Every input, slider, toggle and button has a plain-English tooltip (see section 3).
- **No personal data in public repos.** Use sample or placeholder data (for example Starfleet-themed names). Squash or clean history before a repo is made public.

## 2. Stack and tooling

- **Frontend:** React 19 + TypeScript (`strict`) + Vite. Tailwind CSS v4 via `@import "tailwindcss";` in `src/index.css` and the `@tailwindcss/vite` plugin. Vanilla TypeScript is acceptable for very small tools. `app-showcase` uses Astro.
- **Hosting.** Choose one per project and record it in the fleet inventory (section 10):
  - **Cloudflare Workers with static assets:** `wrangler.jsonc` with `assets.directory: "./dist"` and `not_found_handling: "single-page-application"`, deployed with `npx wrangler deploy`.
  - **Cloudflare Pages:** no `wrangler.jsonc`, deployed from the Git repo.
  - Custom domains are attached in the Cloudflare dashboard, not in the repo.
- **Lint:** `oxlint`. Keep it at 0 warnings and 0 errors.
- **Standard npm scripts** (same names everywhere):

  ```bash
  npm run dev       # Vite dev server
  npm run build     # tsc -b && vite build
  npm run lint      # oxlint
  npm run deploy    # npm run build && wrangler deploy (Workers projects)
  ```

  Add `typecheck` and `test` scripts when a project has them.
- **Release gate:** `npm run lint && npm run build` must pass before a change is done.

## 3. Design and brand

- **Theme:** canvas `bg-slate-950`, cards `bg-slate-900` (or `bg-slate-900/70`), borders `border-slate-800`, accent `cyan-500` / `cyan-400`. Use emerald for "safe / zero tracking" badges, amber for warnings and rose for errors.
- **Mobile-first.** No horizontal overflow at 390px wide. Also check 320px and 375px.
- **Tooltips.** Every input, control and action that a non-expert might not understand gets a plain-English `InfoTooltip` (the "?" badge). Use the shared `InfoTooltip` component, not a copy.
- **No duplicate tooltips.** Don't also set a `title` attribute on a control that already has an `InfoTooltip`. Use `title` on controls with no visible tooltip, such as tab buttons and export buttons.
- **Favicon.** A 64×64 slate and cyan SVG. Add a `?v=2` cache-buster to the link so updates show.
- **SEO and social.** Meta description under 160 characters, a canonical URL, and an OG image at 1200×630.
- **Zero tracking.** No analytics, pixels or third-party scripts unless the project spec allows them. Say in the UI when processing is local.
- **Brand links.** The "← App Showcase" link goes to `https://apps.the-lal.net`.

## 4. Accessibility (WCAG 2.2 AA is the target)

- **Labels.** Every form control has an accessible name. Link `<label htmlFor>` to the input, with `useId()` for generated IDs. Don't use a `<label>` that wraps no control. Use a `<span>` instead.
- **Descriptions.** Link help text with `aria-describedby`. Don't leave it only in `title`.
- **Groups.** Related buttons (for example layout choices) get `role="group"` and `aria-labelledby`.
- **Toggles.** A button that switches a mode on or off gets `aria-pressed`.
- **Tabs.** `role="tablist"`, `role="tab"` (with `aria-selected`, `aria-controls` and roving `tabIndex`) and `role="tabpanel"`. Support Left, Right, Home and End keys.
- **Status messages.** Toasts and save confirmations go in an always-mounted `role="status"` / `aria-live="polite"` container.
- **File inputs.** Visually hidden with `sr-only`, not `hidden`, so they stay keyboard reachable. Show a `focus-within` ring on the wrapping label.
- **Focus.** Keep a visible focus indicator. The global `:focus-visible` rule in `index.css` is the baseline.
- **Contrast.** Body text is at least `slate-400` on dark backgrounds. Don't use `slate-500` for small text or interactive elements.
- **Tooltips** dismiss with Escape and stay inside the viewport.

## 5. Components and structure

- Reusable pieces go in `src/components/`, hooks in `src/hooks/`. Keep `App.tsx` a thin shell where possible.
- Repeated components (text fields, colour pickers) are data-driven from config arrays, not copy-pasted.
- One export style per module. Prefer named exports for components.
- Shared constants (limits, brand URLs) live in one place.
- Split a component file once it passes about 400 lines.

## 6. Privacy and security

- **No secrets in the repo.** `.env*`, `.dev.vars` and any `*.secrets/` directory must be in `.gitignore`.
- **Never log personal data** (emails, phone numbers, uploaded images) to the console or to a server.
- **Untrusted text** (anything a user types that is shown or stored) is escaped or sanitized before it reaches HTML or storage. Use the project's sanitizer where one exists.
- **Validate URLs** before writing them into HTML. Allow `https://`, and `data:image/` for images only. Reject `javascript:` and odd relative paths.
- **Client-side first.** If a feature can run in the browser, keep it there, and say so in the UI.

## 7. Code comments

- Comment *why*, not *what*. Don't restate the next line.
- Give each exported function, component or non-obvious rule a short block comment. Explain security rules and edge cases especially.
- Keep copyright headers and `LICENSE` text intact.
- No commented-out code, and no TODOs without a backlog reference.

## 8. Persistence

- Browser storage keys are namespaced and versioned, for example `the_lal_<app>_<thing>_v1`. Don't rename a key once users have data under it.
- Parse stored data defensively: check its shape and discard bad entries rather than trusting `JSON.parse`.
- Wrap `localStorage` writes in `try/catch` and tell the user when a save fails.

## 9. Workflow and versioning

- **Read the project docs first** (`AGENTS.md`, `CLAUDE.md`, `PROJECT_SPEC.md`, `README.md`, whichever exist).
- **Small, focused changes.** One concern per commit.
- **Don't push, deploy or change infrastructure** unless asked. Local commits are fine when asked to commit.
- **Versioning.** Every project uses SemVer `MAJOR.MINOR.PATCH` in `package.json`.
  - **One change, one version.** Each change gets its own bump, and its commit starts `vX.Y.Z: <summary>`. Don't batch changes under one version.
  - **PATCH** for fixes and copy or style tweaks. **MINOR** for new features or visible behaviour. **MAJOR** for breaking changes such as renamed storage keys, changed URLs or changed data formats.
  - **Bump with** `npm version X.Y.Z --no-git-tag-version`, which updates the lockfile too. **New projects start at `0.1.0`.**
  - **Tags.** Annotate a tag for each deployed release: `git tag -a vX.Y.Z -m "vX.Y.Z: <summary>"`. Tags are rollback points.
  - **Show the version in the UI.** Display it in the footer, read from `package.json` through Vite's `define` as `__APP_VERSION__`. Don't hard-code it.
  - **Record it.** If the project has a changelog or spec, add an entry for each version.
- **Docs-only changes** that don't alter behaviour use `docs:` and don't need a version bump.
- **Verify.** Run the release gate before reporting work as done. For UI changes, check the page in a browser at mobile and desktop widths.
- **Keep this file current.** When a standard changes, update this file and recopy it to each project.

## 10. Fleet inventory

Record each project's hosting here. Update it when a project's hosting changes.

| Project | Domain | Hosting | Notes |
|---|---|---|---|
| `sig` | `sig.the-lal.net` | Workers (static assets) | Custom domain set in dashboard |
| `holodeck-replicator` | `replicator.the-lal.net` | Pages per design; repo now has Workers config | Confirm which is live |
| `pdf-signer` | `pdf-signer.the-lal.net` | Pages | Repo has no `wrangler.jsonc` |
| `app-showcase` | `apps.the-lal.net` | Pages | Astro catalog |
| `promenade` | `promenade.the-lal.net`, `thepromena.de` | Workers | Has D1 database |
| `ten-forward` | `ten-forward` (domain to confirm) | Workers | |

## 11. Known gaps

- Some projects have large single-file components. Split them past about 400 lines.
- Not every project has tests yet. Add a test runner when logic grows beyond simple UI.
