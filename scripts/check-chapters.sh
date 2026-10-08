#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
CHECK_DIR=$(mktemp -d)
trap 'rm -rf "$CHECK_DIR"' EXIT
cat > "$CHECK_DIR/metadata.txt" <<'META'
;FFMETADATA1
[CHAPTER]
TIMEBASE=1/1000
START=0
END=2000
title=Opening
[CHAPTER]
TIMEBASE=1/1000
START=2000
END=4000
title=Across the Valley
[CHAPTER]
TIMEBASE=1/1000
START=4000
END=6000
title=Home
META
ffmpeg -v error -f lavfi -i anullsrc=r=44100:cl=mono -i "$CHECK_DIR/metadata.txt" \
    -t 6 -map_metadata 1 -map_chapters 1 -c:a aac "$CHECK_DIR/book.m4b"
ffmpeg -v error -i "$CHECK_DIR/book.m4b" -map_chapters -1 -c:a copy "$CHECK_DIR/plain.m4b"
swiftc -module-cache-path "$CHECK_DIR/modules" -parse-as-library \
    Magpie/Models/Chapter.swift Magpie/Services/AudioFiles.swift \
    Magpie/Services/ChapterReader.swift Tests/ChapterChecks.swift -o "$CHECK_DIR/check"
"$CHECK_DIR/check" "$CHECK_DIR/book.m4b" "$CHECK_DIR/plain.m4b"
