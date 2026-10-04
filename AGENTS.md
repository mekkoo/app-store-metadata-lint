# App Store Metadata Lint

Small offline TypeScript CLI. Node.js is pinned in mise.toml; run commands with
`mise exec -- npm run ...`. Source and test files use native Node TypeScript
support, so keep syntax erasable. Runtime dependencies are intentionally absent.

- Work only in this directory. Do not modify the original shared ASO Skill or app repositories.
- The user authorized creating this personal OSS under `mekkoo` on 2026-10-04.
  The repository is `mekkoo/app-store-metadata-lint`; keep unrelated projects separate.
  Keep organization branding out of source, docs, metadata, and Git history.
  npm publication and Codex for OSS application submission require their own request.
- `package.json` stays private to prevent accidental npm publication.
- Validate with `npm run check`, `npm run demo`, and `npm run pack:check`.
  Stage candidate files and run `npm run check:publication` before every public push.
  The publication check reads the Git index; never print detected secret values.
- Findings are deterministic local checks, not proof of App Store acceptance,
  indexing behavior, keyword demand, or ranking improvement.
- Keep hard constraints and advisory heuristics separate. Record Apple source links
  and documentation discrepancies in docs/rules.md before changing rules.
- Examples must be synthetic. Never add production metadata, identifiers, accounts,
  analytics, credentials, or machine-specific paths to the public-facing package.
