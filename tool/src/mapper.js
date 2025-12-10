// mapper.js

const { readFileLines } = require("./file_io");
const { normalizeLines } = require("./normalize");
const {
  contentSimilarity,
  contextSimilarity,
  combinedSimilarity,
} = require("./similarity");

async function mapFiles(oldPath, newPath) {
  const oldRaw = readFileLines(oldPath);
  const newRaw = readFileLines(newPath);

  const oldLines = normalizeLines(oldRaw);
  const newLines = normalizeLines(newRaw);

  return mapLines(oldLines, newLines);
}

function mapLines(oldLines, newLines) {
  const matchSet = [];
  const usedOld = new Set();
  const usedNew = new Set();

  for (const oldline of oldLines) {
    for (const newline of newLines) {
      if (
        oldline.norm == newline.norm &&
        !usedOld.has(oldline.norm) &&
        !usedNew.has(newline.norm)
      ) {
        const isTrivial = isTrivialLine(oldline) && isTrivialLine(newline);

        matchSet.push({
          old: oldline.num,
          new: [newline.num],
          status: isTrivial ? "trivial_match" : "match",
        });

        usedOld.add(oldline.norm);
        usedNew.add(newline.norm);
      }
    }
  }

  const oldLinesNoMatch = oldLines.filter((l) => !usedOld.has(l.norm));
  const newLinesNoMatch = newLines.filter((l) => !usedNew.has(l.norm));

  const usedOldNums = new Set();
  const usedNewNums = new Set();

  for (const m of matchSet) {
    usedOldNums.add(m.old);
    for (const nn of m.new) {
      usedNewNums.add(nn);
    }
    if (typeof m.score === "undefined") {
      m.score = 1;
    }
  }

  const TOP_K = 15;
  const SIM_THRESHOLD = 0.5;
  const CONTEXT_RADIUS = 2;
  const candidateList = [];

  const remainingOld = oldLines.filter((l) => !usedOldNums.has(l.num));
  const SPLIT_MAX_GROUP = 3;
  const SPLIT_THRESHOLD = SIM_THRESHOLD;
  const SPLIT_MAX_OFFSET = 3;
  const SPLIT_CONTEXT_RADIUS = 1;

  for (const oldline of remainingOld) {
    if (isTrivialLine(oldline)) continue;

    let bestGroup = null;
    let bestScore = 0;

    const ctxOld = getContext(oldLines, oldline.num, SPLIT_CONTEXT_RADIUS);

    for (let i = 0; i < newLines.length; i++) {
      if (Math.abs(oldline.num - newLines[i].num) > SPLIT_MAX_OFFSET) continue;

      if (usedNewNums.has(newLines[i].num)) continue;
      if (isTrivialLine(newLines[i])) continue;

      for (let size = 2; size <= SPLIT_MAX_GROUP; size++) {
        const group = [];
        let allFree = true;

        for (let k = 0; k < size; k++) {
          const idx = i + k;
          if (idx >= newLines.length) {
            allFree = false;
            break;
          }
          const ln = newLines[idx];
          if (usedNewNums.has(ln.num)) {
            allFree = false;
            break;
          }
          if (isTrivialLine(ln)) {
            allFree = false;
            break;
          }
          group.push(ln);
        }

        if (!allFree || group.length < 2) continue;

        const combinedNorm = group.map((g) => g.norm).join(" ");
        const ctxNew = getContext(newLines, group[0].num, SPLIT_CONTEXT_RADIUS);

        const contentSim = contentSimilarity(oldline.norm, combinedNorm);
        const ctxSim = contextSimilarity(ctxOld, ctxNew);
        const score = combinedSimilarity(contentSim, ctxSim);

        if (score > bestScore) {
          bestScore = score;
          bestGroup = group;
        }
      }
    }

    if (bestGroup && bestScore >= SPLIT_THRESHOLD) {
      usedOldNums.add(oldline.num);
      for (const g of bestGroup) {
        usedNewNums.add(g.num);
      }

      matchSet.push({
        old: oldline.num,
        new: bestGroup.map((g) => g.num),
        status: "match_split",
        score: bestScore,
      });
    }
  }

  for (const oldline of oldLinesNoMatch) {
    if (isTrivialLine(oldline)) continue;

    const ctxOld = getContext(oldLines, oldline.num, CONTEXT_RADIUS);
    const candidates = [];

    for (const newline of newLinesNoMatch) {
      if (usedNewNums.has(newline.num)) continue;
      if (isTrivialLine(newline)) continue;

      const ctxNew = getContext(newLines, newline.num, CONTEXT_RADIUS);

      const contentSim = contentSimilarity(oldline.norm, newline.norm);
      const ctxSim = contextSimilarity(ctxOld, ctxNew);
      const score = combinedSimilarity(contentSim, ctxSim);

      candidates.push({
        old: oldline.num,
        new: newline.num,
        score,
      });
    }

    candidates.sort((a, b) => b.score - a.score);
    const topCandidates = candidates
      .slice(0, TOP_K)
      .filter((c) => c.score >= SIM_THRESHOLD);

    if (topCandidates.length > 0) {
      candidateList.push({
        old: oldline.num,
        candidates: topCandidates,
      });
    }
  }

  const flatCandidates = [];
  for (const entry of candidateList) {
    for (const cand of entry.candidates) {
      flatCandidates.push(cand);
    }
  }
  flatCandidates.sort((a, b) => b.score - a.score);

  for (const cand of flatCandidates) {
    if (usedOldNums.has(cand.old)) continue;
    if (usedNewNums.has(cand.new)) continue;

    usedOldNums.add(cand.old);
    usedNewNums.add(cand.new);

    const oldObj = oldLines.find((l) => l.num === cand.old);
    const newObj = newLines.find((l) => l.num === cand.new);
    const isTrivial =
      oldObj && newObj && isTrivialLine(oldObj) && isTrivialLine(newObj);

    matchSet.push({
      old: cand.old,
      new: [cand.new],
      status: isTrivial ? "trivial_match" : "match",
      score: cand.score,
    });
  }

  for (const oldline of oldLines) {
    if (!usedOldNums.has(oldline.num)) {
      usedOldNums.add(oldline.num);
      matchSet.push({
        old: oldline.num,
        new: [],
        status: "unmatched",
        score: 0,
      });
    }
  }

  matchSet.sort((a, b) => a.old - b.old);

  return matchSet;
}

function isTrivialLine(line) {
  const n = (line?.norm || "").trim();

  if (!n) return true;

  if (/[a-zA-Z0-9]/.test(n)) {
    return false;
  }

  if (n.length <= 2) {
    return true;
  }

  return false;
}

function getContext(lines, lineNum, radius) {
  const ctx = [];
  const idx = lineNum - 1;

  for (
    let i = Math.max(0, idx - radius);
    i <= Math.min(lines.length - 1, idx + radius);
    i++
  ) {
    if (i === idx) continue;

    const ln = lines[i];
    if (!ln) continue;

    const n = (ln.norm || "").trim();
    if (!n) continue;

    if (!isTrivialLine(ln)) {
      ctx.push(n);
    }
  }

  return ctx;
}

module.exports = {
  mapFiles,
  mapLines,
};
