#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type */
/*
 * Generates CHANGELOG.md from git tags + conventional commits.
 * Run: node scripts/generate-changelog.cjs
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const REPO_URL = 'https://github.com/limboy/soundbox'

const GROUPS = [
  { type: 'feat', title: 'Features' },
  { type: 'fix', title: 'Bug Fixes' },
  { type: 'perf', title: 'Performance' },
  { type: 'refactor', title: 'Refactoring' },
  { type: 'docs', title: 'Documentation' },
  { type: 'style', title: 'Styles' },
  { type: 'test', title: 'Tests' },
  { type: 'build', title: 'Build' },
  { type: 'ci', title: 'CI' },
  { type: 'chore', title: 'Chores' }
]
const KNOWN_TYPES = new Set(GROUPS.map((g) => g.type))

const sh = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim()

function getTags() {
  const raw = sh('git tag --list "v*" --sort=-creatordate')
  if (!raw) return []
  return raw.split('\n').filter(Boolean)
}

function getTagDate(tag) {
  return sh(`git log -1 --format=%ad --date=short ${tag}`)
}

function getCommits(range) {
  const fmt = '%H%x1f%s%x1f%b%x1e'
  const out = sh(`git log ${range} --no-merges --format=${fmt}`)
  if (!out) return []
  return out
    .split('\x1e')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const [hash, subject, body] = entry.split('\x1f')
      return { hash, subject: subject || '', body: body || '' }
    })
}

function parseCommit(c) {
  // type(scope)!: subject
  const m = c.subject.match(/^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/)
  if (!m) return null
  const [, type, scope, bang, desc] = m
  const breaking = !!bang || /BREAKING CHANGE:/.test(c.body)
  return { type: type.toLowerCase(), scope, desc, breaking, hash: c.hash }
}

function formatCommit(p) {
  const short = p.hash.slice(0, 7)
  const scope = p.scope ? `**${p.scope}:** ` : ''
  const bang = p.breaking ? ' ⚠️' : ''
  return `- ${scope}${p.desc} ([${short}](${REPO_URL}/commit/${p.hash}))${bang}`
}

function renderSection(header, dateStr, commits) {
  const itemsByType = new Map()
  const others = []
  const breaking = []

  for (const c of commits) {
    const p = parseCommit(c)
    if (p) {
      if (p.breaking) breaking.push(p)
      if (!KNOWN_TYPES.has(p.type)) {
        others.push(p)
      } else {
        if (!itemsByType.has(p.type)) itemsByType.set(p.type, [])
        itemsByType.get(p.type).push(p)
      }
    } else {
      others.push({
        desc: c.subject,
        hash: c.hash,
        breaking: false
      })
    }
  }

  if (breaking.length === 0 && itemsByType.size === 0 && others.length === 0) return ''

  const lines = [`## ${header}${dateStr ? ` - ${dateStr}` : ''}`, '']

  if (breaking.length) {
    lines.push('### ⚠️ BREAKING CHANGES', '')
    for (const p of breaking) lines.push(formatCommit(p))
    lines.push('')
  }

  for (const g of GROUPS) {
    const items = itemsByType.get(g.type)
    if (!items || items.length === 0) continue
    lines.push(`### ${g.title}`, '')
    for (const p of items) lines.push(formatCommit(p))
    lines.push('')
  }

  if (others.length > 0) {
    const filteredOthers = others.filter((o) => !/^\d+\.\d+\.\d+$/.test(o.desc))
    if (filteredOthers.length > 0) {
      lines.push('### Other Changes', '')
      for (const o of filteredOthers) {
        const short = o.hash.slice(0, 7)
        lines.push(`- ${o.desc} ([${short}](${REPO_URL}/commit/${o.hash}))`)
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}

function main() {
  const tags = getTags()
  const sections = []

  const latest = tags[0]
  const unreleasedRange = latest ? `${latest}..HEAD` : 'HEAD'
  const unreleasedCommits = getCommits(unreleasedRange)
  if (unreleasedCommits.length) {
    const s = renderSection(
      latest ? `[Unreleased](${REPO_URL}/compare/${latest}...HEAD)` : 'Unreleased',
      '',
      unreleasedCommits
    )
    if (s) sections.push(s)
  }

  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i]
    const prev = tags[i + 1]
    const range = prev ? `${prev}..${tag}` : tag
    const commits = getCommits(range)
    const date = getTagDate(tag)
    const header = prev
      ? `[${tag}](${REPO_URL}/compare/${prev}...${tag})`
      : `[${tag}](${REPO_URL}/releases/tag/${tag})`
    const s = renderSection(header, date, commits)
    if (s) sections.push(s)
  }

  const content =
    [
      '# Changelog',
      '',
      'All notable changes to this project are documented here.',
      'This file is generated automatically from [Conventional Commits](https://www.conventionalcommits.org/) — run `npm run changelog` to regenerate.',
      '',
      sections.join('\n')
    ]
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd() + '\n'

  const out = path.resolve(__dirname, '..', 'CHANGELOG.md')
  fs.writeFileSync(out, content)
  console.log(`Wrote ${out} (${sections.length} section${sections.length === 1 ? '' : 's'})`)

  const releaseNotesIndex = 0
  if (sections[releaseNotesIndex]) {
    const lines = sections[releaseNotesIndex].split('\n')
    const headerLine = lines[0]
    const body = lines.slice(2).join('\n').trim()

    const compareMatch = headerLine.match(
      /\((https:\/\/github\.com\/[^/]+\/[^/]+\/compare\/[^)]+)\)/
    )
    const compareUrl = compareMatch ? compareMatch[1] : null

    let finalNotes = body
    if (compareUrl) {
      finalNotes += `\n\n**Full Changelog**: ${compareUrl}`
    }

    const notesPath = path.resolve(__dirname, '..', 'RELEASENOTES.md')
    fs.writeFileSync(notesPath, finalNotes)
    console.log(`Wrote ${notesPath}`)
  }
}

main()
