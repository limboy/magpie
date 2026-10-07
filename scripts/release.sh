#!/bin/zsh
# Builds, signs and publishes a Magpie release that Sparkle can install.
#
#   scripts/release.sh 0.2.0 [notes.md]
#
# Sets the version in project.yml, commits and tags it (v0.2.0), builds the
# Release app, zips it, signs the zip with the Sparkle key in your Keychain,
# writes appcast.xml, and creates a GitHub release with both. The app's feed
# is releases/latest/download/appcast.xml, so the newest release is the feed.
#
# Release notes come from the given Markdown file (one "- item" per line),
# or else from the commit subjects since the last tag.
#
# DRY_RUN=1 skips git and GitHub and leaves the zip and appcast in dist/.
# For testing, BUNDLE_ID, FEED_URL, DOWNLOAD_BASE and BUILD_NUMBER override
# the defaults.
set -euo pipefail

cd "$(dirname "$0")/.."
version=${1:?usage: scripts/release.sh <version> [notes.md]}
notes_file=${2:-}
repo=limboy/magpie-native
tag="v$version"
download_base=${DOWNLOAD_BASE:-https://github.com/$repo/releases/download/$tag}
dry_run=${DRY_RUN:-0}
derived=build/release
dist=dist
sparkle_bin=$derived/SourcePackages/artifacts/sparkle/Sparkle/bin

if [[ $dry_run != 1 ]]; then
  [[ -z $(git status --porcelain) ]] || { echo "Commit or stash your changes first." >&2; exit 1; }
  [[ $(git branch --show-current) == main ]] || { echo "Release from main." >&2; exit 1; }
  git rev-parse -q --verify "refs/tags/$tag" >/dev/null && { echo "$tag already exists." >&2; exit 1; }
  gh auth status >/dev/null
fi

# Notes, before the release commit lands.
notes=$(mktemp)
if [[ -n $notes_file ]]; then
  cat "$notes_file" > "$notes"
else
  last_tag=$(git describe --tags --abbrev=0 2>/dev/null || true)
  git log --no-merges --format='- %s' ${last_tag:+$last_tag..}HEAD > "$notes"
fi

if [[ $dry_run != 1 ]]; then
  sed -i '' -E "s/^( *MARKETING_VERSION: ).*/\1\"$version\"/" project.yml
  xcodegen generate >/dev/null
  git commit -q -am "Release $tag"
fi

# Sparkle compares build numbers; the commit count only goes up on main.
build_number=${BUILD_NUMBER:-$(git rev-list --count HEAD)}

extra=()
[[ -n ${BUNDLE_ID:-} ]] && extra+=("PRODUCT_BUNDLE_IDENTIFIER=$BUNDLE_ID")
[[ -n ${FEED_URL:-} ]] && extra+=("SPARKLE_FEED_URL=$FEED_URL")
xcodebuild -project Magpie.xcodeproj -scheme Magpie -configuration Release \
  -derivedDataPath $derived -clonedSourcePackagesDirPath $derived/SourcePackages \
  MARKETING_VERSION="$version" CURRENT_PROJECT_VERSION="$build_number" "${extra[@]}" \
  build | grep -E "error:|BUILD" || true
app=$derived/Build/Products/Release/Magpie.app
[[ -d $app ]] || { echo "Build failed." >&2; exit 1; }

mkdir -p $dist
zip_name="Magpie-$version.zip"
rm -f "$dist/$zip_name"
ditto -c -k --sequesterRsrc --keepParent "$app" "$dist/$zip_name"
# Prints: sparkle:edSignature="…" length="…"
signature=$("$sparkle_bin/sign_update" "$dist/$zip_name")

notes_html=$(sed -E 's/^[-*] +(.*)$/<li>\1<\/li>/' "$notes" | grep '^<li>' || true)
cat > $dist/appcast.xml <<EOF
<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel>
    <title>Magpie</title>
    <item>
      <title>Magpie $version</title>
      <pubDate>$(LC_ALL=C date -u '+%a, %d %b %Y %H:%M:%S +0000')</pubDate>
      <sparkle:version>$build_number</sparkle:version>
      <sparkle:shortVersionString>$version</sparkle:shortVersionString>
      <sparkle:minimumSystemVersion>26.0</sparkle:minimumSystemVersion>
      <description><![CDATA[<ul>
$notes_html
</ul>]]></description>
      <enclosure url="$download_base/$zip_name" type="application/octet-stream" $signature />
    </item>
  </channel>
</rss>
EOF

if [[ $dry_run == 1 ]]; then
  echo "Dry run: $dist/$zip_name and $dist/appcast.xml (build $build_number)."
  exit 0
fi

git tag "$tag"
git push -q origin main "$tag"
gh release create "$tag" "$dist/$zip_name" "$dist/appcast.xml" \
  --repo $repo --title "Magpie $version" --notes-file "$notes"
echo "Released Magpie $version (build $build_number)."
