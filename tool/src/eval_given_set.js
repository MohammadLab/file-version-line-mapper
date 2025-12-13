const fs = require("fs");
const path = require("path");

function parseGoldXml(xmlText) {
  const cleaned = xmlText.replace(/<!--[\s\S]*?-->/g, ""); //get rid of XML comments

  const version2Regex = /<VERSION\s+NUMBER="2"[^>]*>([\s\S]*?)<\/VERSION>/;
  const vm = version2Regex.exec(cleaned);
  const body2 = vm[1]; //(only read v2)

  const gold = new Map();
  const locRegex = /<LOCATION\s+ORIG="(\d+)"\s+NEW="(-?\d+)"\s*\/>/g;
  let m;
  while ((m = locRegex.exec(body2)) !== null) {
    const orig = parseInt(m[1], 10);
    const newOne = parseInt(m[2], 10);
    if (newOne > 0) {
      gold.set(orig, newOne);
    }
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
    "eclipseTest"
  );

  const mappingsDir = path.resolve(__dirname, "mappingsGivenSet");

  let globalCorrect = 0;
  let globalTotal = 0;

  const files = fs.readdirSync(mappingsDir).filter((f) => f.endsWith(".json"));

  for (const f of files) {
    const base = path.basename(f, ".json"); // ex) "ResourceInfo"
    const goldPath = path.join(datasetDir, `${base}.xml`);
    const predPath = path.join(mappingsDir, f);

    if (!fs.existsSync(goldPath)) {
      console.log(`${base}: missing gold file ${goldPath}, skipping`);
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
      `${base}: ${correct}/${total} = ${(accuracy * 100).toFixed(1)}%`
    );
  }

  const overall = (globalCorrect / globalTotal) * 100;
  console.log(
    `Overall: ${globalCorrect}/${globalTotal} = ${overall.toFixed(1)}% accuracy`
  );
}

main();
