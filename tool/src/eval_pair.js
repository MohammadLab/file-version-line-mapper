//ONLY TO TEST OUR DATASET, PROVIDED DATA SET EVALUTATED USING eval_given_set.js
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
    if (!gold.has(orig)) continue;

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
  const datasetDir = path.resolve(
    __dirname,
    "..",
    "..",
    "Dataset",
    "dataset_pairs"
  );
  const mappingsDir = path.resolve(__dirname, "mappings");

  let globalCorrect = 0;
  let globalTotal = 0;

  for (let i = 1; i <= 25; i++) {
    const num = String(i).padStart(2, "0");
    const goldPath = path.join(datasetDir, `pair_${num}_mapping.xml`);
    const predPath = path.join(mappingsDir, `mapping${i}.json`);

    if (!fs.existsSync(goldPath)) {
      console.log(`pair_${num}: missing gold file ${goldPath}, skipping`);
      continue;
    }
    if (!fs.existsSync(predPath)) {
      console.log(`pair_${num}: missing prediction file ${predPath}, skipping`);
      continue;
    }

    const goldXml = fs.readFileSync(goldPath, "utf8");
    const predJson = fs.readFileSync(predPath, "utf8");

    const gold = parseGoldXml(goldXml);
    const predicted = JSON.parse(predJson);

    const { correct, total, accuracy } = computeAccuracy(gold, predicted, {
      ignoreTrivial: false,
    });

    globalCorrect += correct;
    globalTotal += total;

    console.log(
      `pair_${num}: ${correct}/${total} = ${(accuracy * 100).toFixed(1)}%`
    );
  }

  console.log("--------------------------------------------------");
  if (globalTotal === 0) {
    console.log("No valid pairs evaluated.");
  } else {
    const overall = (globalCorrect / globalTotal) * 100;
    console.log(
      `Overall: ${globalCorrect}/${globalTotal} = ${overall.toFixed(
        1
      )}% accuracy`
    );
  }
}

main();
