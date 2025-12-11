#!/usr/bin/env bash
set -euo pipefail

mkdir -p mappings

for i in $(seq 1 25); do
  num=$(printf "%02d" "$i")

  old="../../Dataset/dataset_pairs/pair_${num}_v1.java"
  new="../../Dataset/dataset_pairs/pair_${num}_v2.java"
  gold="../../Dataset/dataset_pairs/pair_${num}_mapping.xml"
  out="mappings/mapping${i}.json"

  echo "Running pair ${num} -> ${out}"

  if [[ ! -f "$old" ]]; then
    echo "  Missing: $old (skipping)"
    continue
  fi

  if [[ ! -f "$new" ]]; then
    echo "  Missing: $new (skipping)"
    continue
  fi

  node map_lines.js "$old" "$new" "$out"

  if [[ -f "$gold" ]]; then
    node eval_pair.js "$gold" "$out" "pair_${num}"
  else
    echo "  (No gold mapping XML found at $gold, skipping accuracy check)"
  fi
done


echo "Finished running all pairs."
