#!/bin/sh
# Run every character's sweep in parallel; JSON lands in $OUT (default /tmp/ladder-sweep).
# Usage: tools/sweep-all.sh [careers] [out-dir] [characters...]
CAREERS=${1:-40}
OUT=${2:-/tmp/ladder-sweep}
shift 2 2>/dev/null
mkdir -p "$OUT"
CHARS=${*:-"simon jennifer chloe joseph richard christian adam eve chaitravi bill"}
for c in $CHARS; do
  node "$(dirname "$0")/sweep-one.js" "$c" "$CAREERS" > "$OUT/$c.json" 2>/dev/null &
done
wait
