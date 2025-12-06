// mapper.js

const { readFileLines } = require("./file_io");
const { normalizeLines } = require("./normalize");
const {
  contentSimilarity,
  contextSimilarity,
  combinedSimilarity,
} = require("./similarity");

/**
 * High-level entry point: maps two files and returns the mapping array.
 */
async function mapFiles(oldPath, newPath) {
  const oldRaw = readFileLines(oldPath);
  const newRaw = readFileLines(newPath);

  const oldLines = normalizeLines(oldRaw); // [{ num, text, norm }, ...]
  const newLines = normalizeLines(newRaw);

  return mapLines(oldLines, newLines);
}

/**
 * Core mapping logic:
 * - Global alignment using dynamic programming.
 * - Respects line order.
 * - Allows gaps (insertions/deletions).
 */
function mapLines(oldLines, newLines) {
  // 1. Find exact matches

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
        matchSet.push({
          old: oldline.num,
          new: [newline.num],
          status: "match",
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
  const SIM_THRESHOLD = 0.51;
  const CONTEXT_RADIUS = 2;
  const candidateList = [];

  for (const oldline of oldLinesNoMatch) {
    if (isTrivialLine(oldline)) continue; // NEW: skip trivial old lines

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

    matchSet.push({
      old: cand.old,
      new: [cand.new],
      status: "match",
      score: cand.score,
    });
  }

  const remainingOld = oldLines.filter((l) => !usedOldNums.has(l.num));
  const SPLIT_MAX_GROUP = 3; // try up to 3-line splits
  const SPLIT_THRESHOLD = SIM_THRESHOLD; // reuse same threshold
  const SPLIT_MAX_OFFSET = 3; // NEW: max distance in line numbers
  const SPLIT_CONTEXT_RADIUS = 1; // NEW: tighter context for splits

  for (const oldline of remainingOld) {
    if (isTrivialLine(oldline)) continue; // NEW: don't split on trivial lines

    let bestGroup = null;
    let bestScore = 0;

    const ctxOld = getContext(oldLines, oldline.num, SPLIT_CONTEXT_RADIUS); // NEW

    // iterate over all newLines and try consecutive groups
    for (let i = 0; i < newLines.length; i++) {
      // NEW: only consider groups near this old line
      if (Math.abs(oldline.num - newLines[i].num) > SPLIT_MAX_OFFSET) continue;

      // first line of group must be unused
      if (usedNewNums.has(newLines[i].num)) continue;
      if (isTrivialLine(newLines[i])) continue; // NEW: don't start split on trivial line

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
            // NEW: whole group must be non-trivial
            allFree = false;
            break;
          }
          group.push(ln);
        }

        if (!allFree || group.length < 2) continue;

        const combinedNorm = group.map((g) => g.norm).join(" ");
        const ctxNew = getContext(newLines, group[0].num, SPLIT_CONTEXT_RADIUS); // NEW

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
  const n = (line.norm || "").trim();
  if (!n) return true;
  if (n === "{" || n === "}") return true;
  if (n === ";") return true;
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
    ctx.push(lines[i].norm);
  }

  return ctx;
}

module.exports = {
  mapFiles,
  mapLines,
};
