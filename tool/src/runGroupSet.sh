#!/usr/bin/env bash
set -euo pipefail

# Ensure output directory exists
mkdir -p mappings

for i in $(seq 1 25); do
  num=$(printf "%02d" "$i")

  old="../../Dataset/dataset_pairs/pair_${num}_v1.java"
  new="../../Dataset/dataset_pairs/pair_${num}_v2.java"
  out="mappings/mapping${i}.json"

  echo "Running pair ${num} -> ${out}"

  if [[ ! -f "$old" ]]; then
    echo "Missing file: $old (skipping)"
    continue
  fi

  if [[ ! -f "$new" ]]; then
    echo "Missing file: $new (skipping)"
    continue
  fi

  node map_lines.js "$old" "$new" "$out"
done

echo "Finished running all pairs."
