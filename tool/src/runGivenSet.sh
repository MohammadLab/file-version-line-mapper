#!/usr/bin/env bash
set -euo pipefail

DATASET_DIR="../../Dataset/eclipseTest"
OUT_DIR="mappingsGivenSet"

mkdir -p "$OUT_DIR"


shopt -s nullglob

for old in "$DATASET_DIR"/*_1.java; do
  # e.g. old = .../CompilationUnitDocumentProvider_1.java
  base=$(basename "$old" _1.java)   # "CompilationUnitDocumentProvider"

  new="$DATASET_DIR/${base}_2.java"
  out="$OUT_DIR/${base}.json"

  echo "Running case ${base} -> ${out}"

  if [[ ! -f "$new" ]]; then
    echo "  Missing: $new"
    continue
  fi
  node map_lines.js "$old" "$new" "$out"
done

echo "----------------------------------------"
echo "Now evaluating eclipseTest with XML"
node eval_given_set.js
