#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function parseGoldXml(xmlText) {
  const regex = /<LOCATION ORIG="(\d+)" NEW="(\d+)"/g;
  const gold = new Map();
  let m;
  while ((m = regex.exec(xmlText)) !== null) {
    const orig = parseInt(m[1], 10);
    const neu = parseInt(m[2], 10);
    gold.set(orig, neu);
  }
  return gold;
}

function computeAccuracy(
  gold,
  predicted,
  { ignoreTrivial } = { ignoreTrivial: false }
) {
  let correct = 0;
  let total = 0;

  for (const entry of predicted) {
    const orig = entry.old;
    if (!gold.has(orig)) continue; // old line not in gold mapping

    if (ignoreTrivial && entry.status === "trivial_match") continue;

    const expected = gold.get(orig);
    const predictedNew =
      Array.isArray(entry.new) && entry.new.length > 0 ? entry.new[0] : null;

    if (predictedNew === expected) {
      correct++;
    }
    total++;
  }

  return {
    correct,
    total,
    accuracy: total === 0 ? 0 : correct / total,
  };
}

function main() {
  const [, , goldPathArg, predPathArg, label] = process.argv;

  if (!goldPathArg || !predPathArg) {
    console.error("Usage: node eval_pair.js <goldXml> <predJson> [label]");
    process.exit(1);
  }

  const goldXml = fs.readFileSync(goldPathArg, "utf8");
  const predJson = fs.readFileSync(predPathArg, "utf8");

  const gold = parseGoldXml(goldXml);
  const predicted = JSON.parse(predJson);

  // change ignoreTrivial: true if you want to ignore trivial_match lines
  const { correct, total, accuracy } = computeAccuracy(gold, predicted, {
    ignoreTrivial: false,
  });

  const name = label || path.basename(predPathArg);
  console.log(
    `${name}: ${correct}/${total} = ${(accuracy * 100).toFixed(1)}% accuracy`
  );
}

main();
