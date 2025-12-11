const fs = require("fs");
const path = require("path");

function parseGoldXml(xmlText) {
  // remove XML comments
  const cleaned = xmlText.replace(/<!--[\s\S]*?-->/g, "");

  const versionBodies = new Map();
  const versionRegex = /<VERSION\s+NUMBER="(\d+)"[^>]*>([\s\S]*?)<\/VERSION>/g;
  let vm;
  while ((vm = versionRegex.exec(cleaned)) !== null) {
    const verNum = parseInt(vm[1], 10);
    const body = vm[2];
    versionBodies.set(verNum, body);
  }

  const body1 = versionBodies.get(1);
  const body2 = versionBodies.get(2);

  if (!body1 || !body2) {
    throw new Error("Gold XML does not contain VERSION 1 and VERSION 2");
  }

  function parseVersion(body) {
    const map = new Map();
    const locRegex = /<LOCATION\s+ORIG="(\d+)"\s+NEW="(-?\d+)"\s*\/>/g;
    let m;
    while ((m = locRegex.exec(body)) !== null) {
      const orig = parseInt(m[1], 10);
      const neu = parseInt(m[2], 10);
      map.set(orig, neu);
    }
    return map;
  }

  const v1 = parseVersion(body1);
  const v2 = parseVersion(body2);

  const composed = new Map();
  for (const [orig, new1] of v1.entries()) {
    const new2 = v2.get(orig);
    if (new1 > 0 && new2 > 0) {
      composed.set(new1, new2);
    }
  }

  return composed;
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

  console.log("--------------------------------------------------");
  if (globalTotal === 0) {
    console.log("No cases evaluated.");
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
