---
name: publish
description: Step-by-step procedure for building, bumping version, updating changelog, tagging, and publishing a new release of SoundBox. Use this skill when the user requests to publish, release, tag, or bump version for SoundBox.
---

# SoundBox Publishing & Release Skill

This skill provides step-by-step instructions for publishing and releasing a new version of SoundBox. SoundBox uses Electron, Vite, electron-builder, and GitHub Actions for automated building, signing, notarization, and GitHub Releases.

## Overview of Release Workflow

1. **Pre-flight Checks**: Verify working directory is clean and quality checks pass.
2. **Version Selection & UI Modal Confirmation**: Determine target version options and prompt user via `ask_question` UI modal.
3. **Version Bumping & Changelog Generation**: Update `version` in `package.json` and run `npm run changelog`.
4. **Final Confirmation via UI Modal**: Review release notes and ask for user approval via `ask_question` UI modal.
5. **Commit, Tag & Push**: Commit changes, tag `vX.Y.Z`, and push branch/tag to GitHub to trigger `.github/workflows/release.yml`.
6. **Verification**: Confirm GitHub Action workflow execution.

---

## Mandatory UI Confirmation Checkpoints (`ask_question` Tool)

> [!IMPORTANT]
> The agent **MUST** call the `ask_question` tool to pop up an interactive UI modal at two key checkpoints:
>
> 1. **Version Selection (Checkpoint 1)**: Present version bump choices (Patch, Minor, Major) as selectable radio options in the modal.
> 2. **Release Approval (Checkpoint 2)**: Present final release actions (Confirm & Push, Cancel / Abort) as selectable radio options in the modal.

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
> If there are uncommitted changes, call `ask_question` to ask the user whether to commit, stash, or cancel before proceeding.

### Step 2: Determine Target Version & Prompt UI Modal (Checkpoint 1)

1. Read current version from `package.json` (e.g., `1.3.12`).
2. Calculate target versions for Patch, Minor, and Major bumps:
   - Patch: `1.3.13` (Recommended for bug fixes / tweaks)
   - Minor: `1.4.0` (Recommended for new features)
   - Major: `2.0.0` (Recommended for breaking changes)
3. **Call `ask_question` tool** to present an interactive UI popup modal:

```json
{
  "questions": [
    {
      "question": "Current version is 1.3.12. Which version bump would you like to release?",
      "options": [
        "(Recommended) Patch v1.3.13 (Bug fixes and minor tweaks)",
        "Minor v1.4.0 (New features and enhancements)",
        "Major v2.0.0 (Breaking changes)"
      ],
      "is_multi_select": false
    }
  ],
  "toolAction": "Selecting release version",
  "toolSummary": "Release version selection modal"
}
```

### Step 3: Bump Version & Generate Changelog

Based on the user's selection from the `ask_question` modal:

```bash
npm version <patch|minor|major|custom-version> --no-git-tag-version
```

Run the changelog script to generate release notes:

```bash
npm run changelog
```

This script updates `CHANGELOG.md` and creates `RELEASENOTES.md`.

### Step 4: Final Release Review & Prompt UI Modal (Checkpoint 2)

Display the contents of `RELEASENOTES.md` in the chat window, then **call `ask_question` tool** to prompt for final confirmation:

```json
{
  "questions": [
    {
      "question": "Ready to publish vX.Y.Z? This will commit, create tag vX.Y.Z, and push to GitHub to trigger CI/CD build & release.",
      "options": [
        "(Recommended) Yes, proceed to commit, tag, and push release vX.Y.Z",
        "No, cancel the release process"
      ],
      "is_multi_select": false
    }
  ],
  "toolAction": "Confirming release deployment",
  "toolSummary": "Release deployment confirmation modal"
}
```

### Step 5: Commit, Tag, and Push

If the user selected to proceed in the UI modal:

```bash
# Commit and tag locally
git add package.json package-lock.json CHANGELOG.md
git commit -m "release: vX.Y.Z"
git tag -a vX.Y.Z -m "Release vX.Y.Z"

# Push to origin (triggers GitHub Actions release workflow)
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

Monitor status using `gh` CLI:

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
