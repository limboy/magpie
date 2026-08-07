---
name: release
description: Cut a new Magpie release — pre-flight checks, version bump, changelog + release notes generation, commit, tag, push, and CI monitoring. Use when the user asks to release, publish, ship, cut a version, bump the version, or tag a new version of this app.
---

# Release Magpie

Releases are tag-driven. Pushing a `v*` tag triggers `.github/workflows/release.yml`, which builds, signs, notarizes, and publishes the macOS app to GitHub Releases. Everything before the tag push happens locally.

**Never push the tag without an explicit user confirmation** (Step 5). The tag push starts a signed, notarized, publicly published build — it is not cheaply reversible.

## Repo facts

- Version lives in `package.json` (`version`), tags are `vX.Y.Z`.
- `npm run changelog` (`scripts/generate-changelog.cjs`) regenerates **both** `CHANGELOG.md` and `RELEASENOTES.md` from git tags + Conventional Commits. It is idempotent — never hand-edit either file.
- `RELEASENOTES.md` is what CI puts in the GitHub Release body. CI only *verifies* it is non-empty; it never regenerates it. Whatever you commit is what ships.
- Build target is macOS arm64 (`dmg` + `zip`), signed and notarized with secrets configured in the GitHub repo.

## Step 1 — Pre-flight

```bash
git status --porcelain && git rev-parse --abbrev-ref HEAD
```

```bash
npm run typecheck && npm run lint
```

Requirements:
- On `main`, up to date with `origin/main` (`git fetch && git status -sb`).
- Clean working tree. If dirty, use `AskUserQuestion` to ask whether to commit, stash, or cancel — do not silently include stray changes in the release commit.
- Typecheck and lint pass. CI runs them again in `release.yml`, so a failure here would fail the release anyway.

Also confirm there is something to release:

```bash
git log $(git describe --tags --abbrev=0)..HEAD --oneline --no-merges
```

If that list is empty, stop and tell the user there are no new commits since the last tag.

## Step 2 — Pick the version (confirmation checkpoint 1)

Read the current version from `package.json`, compute patch/minor/major, and call `AskUserQuestion` with the three bumps as options. Recommend one based on the commits from Step 1:

- any `feat:` → minor
- only `fix:`/`chore:`/`docs:`/`refactor:` → patch
- any `!:` or `BREAKING CHANGE:` → major

Put the recommended option first and mark it `(Recommended)`. Include the resulting version number in each label, e.g. `Minor — v1.5.0`.

## Step 3 — Bump and generate notes

```bash
npm version <patch|minor|major> --no-git-tag-version
```

```bash
npm run changelog
```

Order matters: bump first, then generate. The generator derives the release notes from the `<latest-tag>..HEAD` range, so at this point the notes cover exactly the commits being released. Two known consequences, both expected:

- The notes' `**Full Changelog**` link ends in `...HEAD` rather than the new tag.
- The `release: vX.Y.Z` commit itself is not in the notes (it doesn't exist yet).

Step 7 cleans both up in `CHANGELOG.md` after the tag exists.

## Step 4 — Review

Read `RELEASENOTES.md` and show it to the user in full. Sanity-check it: no empty sections, no leftover entries from a previous release, no commit subjects that read as internal noise. If a subject is unhelpful, the fix is a better commit message next time — do not hand-edit the generated file.

## Step 5 — Confirm and ship (confirmation checkpoint 2)

Call `AskUserQuestion`: proceed with commit + tag + push of `vX.Y.Z`, or cancel. State plainly that this publishes a public release.

On cancel, offer to revert the local changes:

```bash
git checkout -- package.json package-lock.json CHANGELOG.md RELEASENOTES.md
```

On confirm:

```bash
git add package.json package-lock.json CHANGELOG.md RELEASENOTES.md
git commit -m "release: vX.Y.Z"
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin main
git push origin vX.Y.Z
```

Push `main` before the tag — CI checks out the tag, and the branch push keeps the two in sync.

## Step 6 — Monitor CI

```bash
gh run list --workflow=release.yml --limit 3
```

```bash
gh run watch $(gh run list --workflow=release.yml --limit 1 --json databaseId --jq '.[0].databaseId')
```

The workflow typechecks and lints, verifies `RELEASENOTES.md` is non-empty, builds the renderer, then runs `electron-builder --mac --publish always` with **up to 3 attempts** — retries are normal and usually mean a transient Apple notarization timeout, not a broken build. It finishes by setting the release body from `RELEASENOTES.md`.

If all three attempts fail, report the actual failing step to the user. Common causes: expired or missing signing secrets (`CSC_LINK`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`), or a genuine Apple Notary outage. Re-running the failed workflow is the first thing to try; do not cut a new version to work around a transient failure.

Verify the published result:

```bash
gh release view vX.Y.Z
```

Expect `.dmg`, `.zip`, and `latest-mac.yml` attached — `latest-mac.yml` is what `electron-updater` reads, so a release missing it will not reach existing users.

## Step 7 — Changelog follow-up

Once the tag exists, regenerate so the `[Unreleased]` section becomes a dated `[vX.Y.Z]` section with proper compare links:

```bash
npm run changelog
git add CHANGELOG.md RELEASENOTES.md
git commit -m "docs: update CHANGELOG for vX.Y.Z"
git push origin main
```

This matches the existing history (`release: v1.3.13` followed by `docs: update CHANGELOG for v1.3.13`).

## Optional — local build check

Only when the user asks to verify packaging before releasing. Requires Apple credentials in `.env` (loaded via `dotenv-cli`); it signs and notarizes for real and takes several minutes.

```bash
npm run build:mac
```

To skip signing/notarization entirely, use `npm run build:unpack`.
