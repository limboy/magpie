---
name: publish
description: Step-by-step procedure for building, bumping version, updating changelog, tagging, and publishing a new release of SoundBox. Use this skill when the user requests to publish, release, tag, or bump version for SoundBox.
---

# SoundBox Publishing & Release Skill

This skill provides step-by-step instructions for publishing and releasing a new version of SoundBox. SoundBox uses Electron, Vite, electron-builder, and GitHub Actions for automated building, signing, notarization, and GitHub Releases.

## Overview of Release Workflow

1. **Pre-flight Checks**: Verify working directory is clean and quality checks pass.
2. **Version Selection & User Confirmation**: Determine target version and ask user for explicit approval.
3. **Version Bumping & Changelog Generation**: Update `version` in `package.json` and run `npm run changelog`.
4. **Final Confirmation before Push**: Review commit diff and release notes with user.
5. **Commit, Tag & Push**: Commit changes, tag `vX.Y.Z`, and push branch/tag to GitHub to trigger `.github/workflows/release.yml`.
6. **Verification**: Confirm GitHub Action workflow execution.

---

## Mandatory Confirmation Checkpoints

> [!IMPORTANT]
> To prevent unintentional releases, the agent **MUST** seek explicit user confirmation at two key checkpoints:
> 1. **Before bumping version**: Confirm current version -> target version (e.g., `1.3.12` -> `1.3.13`) and release type (patch/minor/major).
> 2. **Before pushing tag to origin**: Display generated release notes/commit summary and ask user for final confirmation to execute `git push`.

---

## Step-by-Step Instructions

### Step 1: Pre-flight Verification

Ensure git status is clean and all code checks pass before publishing:

```bash
# Check working tree status
git status

# Run type check and linter
npm run typecheck
npm run lint
```

> [!IMPORTANT]
> If there are uncommitted changes, confirm with the user whether to commit or stash them before proceeding.

### Step 2: Determine Target Version & Request Confirmation (Checkpoint 1)

1. Inspect current version in `package.json` (e.g. `"version": "1.3.12"`).
2. Recommend the target version based on commit history (Patch, Minor, or Major).
3. **Ask user for confirmation**:
   > *"Current version is `1.3.12`. I recommend bumping to `1.3.13` (patch). Would you like to proceed with `1.3.13` or specify a different version?"*

### Step 3: Bump Version & Generate Changelog

Once approved by the user, update `package.json`:

```bash
npm version <patch|minor|major|x.y.z> --no-git-tag-version
```

Run the changelog script:

```bash
npm run changelog
```

This script:
- Updates `CHANGELOG.md` based on Conventional Commits.
- Generates `RELEASENOTES.md` for GitHub Releases.

### Step 4: Final Release Review & User Approval (Checkpoint 2)

Show the generated `RELEASENOTES.md` summary and the target tag `vX.Y.Z` to the user, and ask:
> *"Generated release notes for `vX.Y.Z` are ready. May I proceed with committing, tagging `vX.Y.Z`, and pushing to GitHub to trigger the release pipeline?"*

### Step 5: Commit, Tag, and Push

Upon user approval:

```bash
# Commit and tag locally
git add package.json package-lock.json CHANGELOG.md
git commit -m "release: vX.Y.Z"
git tag -a vX.Y.Z -m "Release vX.Y.Z"

# Push to origin (triggers release workflow)
git push origin main
git push origin vX.Y.Z
```

### Step 6: Monitor CI/CD Release Workflow

Pushing tag `vX.Y.Z` automatically triggers GitHub Actions (`.github/workflows/release.yml`), which:
1. Runs `npm run changelog` to format release notes.
2. Builds the renderer (`npm run build:renderer`).
3. Builds macOS binaries (`dmg`, `zip` arm64), signs with Apple Developer certificate, and notarizes via Apple Notary Service.
4. Creates a new GitHub Release with attached assets (`.dmg`, `.zip`, `latest-mac.yml`).
5. Updates GitHub Release notes using `RELEASENOTES.md`.

You can monitor release status using `gh` CLI:
```bash
gh run list --workflow=release.yml
```

---

## Local Build Verification (Optional)

If local build testing is requested prior to pushing:

```bash
# Build renderer and package macOS app locally
npm run build:mac
```

