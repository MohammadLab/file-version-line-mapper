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
  const n = oldLines.length;
  const m = newLines.length;

  // Build context arrays for each line
  const ctxOld = oldLines.map((line) => getContext(oldLines, line.num, 2));
  const ctxNew = newLines.map((line) => getContext(newLines, line.num, 2));

  // Pre-compute similarity matrix sim[i][j] for 0-based i, j
  const simMatrix = Array.from({ length: n }, () => Array(m).fill(0));
  for (let i = 0; i < n; i++) {
    const aNorm = oldLines[i].norm;
    for (let j = 0; j < m; j++) {
      const bNorm = newLines[j].norm;
      const cSim = contentSimilarity(aNorm, bNorm);
      const xSim = contextSimilarity(ctxOld[i], ctxNew[j]);
      simMatrix[i][j] = combinedSimilarity(cSim, xSim);
    }
  }

  // DP parameters:
  // - GAP_PENALTY: mild cost to skip a line (insert/delete).
  // - ALIGN_SIM_THRESHOLD: similarity needed to allow a "match" step.
  // - OUTPUT_SIM_THRESHOLD: similarity required to output a mapping.
  const GAP_PENALTY = -0.12;
  const ALIGN_SIM_THRESHOLD = 0.4;
  const OUTPUT_SIM_THRESHOLD = 0.45;

  const dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  const choice = Array.from({ length: n + 1 }, () => Array(m + 1).fill(null));

  // Base cases: prefixes vs empty
  for (let i = 1; i <= n; i++) {
    dp[i][0] = dp[i - 1][0] + GAP_PENALTY;
    choice[i][0] = "DEL";
  }
  for (let j = 1; j <= m; j++) {
    dp[0][j] = dp[0][j - 1] + GAP_PENALTY;
    choice[0][j] = "INS";
  }

  // Fill DP table
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const simScore = simMatrix[i - 1][j - 1];

      const matchScore =
        simScore >= ALIGN_SIM_THRESHOLD
          ? dp[i - 1][j - 1] + simScore
          : Number.NEGATIVE_INFINITY;

      const deleteScore = dp[i - 1][j] + GAP_PENALTY;
      const insertScore = dp[i][j - 1] + GAP_PENALTY;

      let bestScore = matchScore;
      let bestChoice = "MATCH";

      if (deleteScore > bestScore) {
        bestScore = deleteScore;
        bestChoice = "DEL";
      }
      if (insertScore > bestScore) {
        bestScore = insertScore;
        bestChoice = "INS";
      }

      dp[i][j] = bestScore;
      choice[i][j] = bestChoice;
    }
  }

  // Backtrack to build mapping
  const mappingByOldNum = new Map();
  let i = n;
  let j = m;

  while (i > 0 || j > 0) {
    const ch = choice[i][j];

    if (ch === "MATCH") {
      const simScore = simMatrix[i - 1][j - 1];
      const oldLine = oldLines[i - 1];
      const newLine = newLines[j - 1];

      if (simScore >= OUTPUT_SIM_THRESHOLD) {
        mappingByOldNum.set(oldLine.num, {
          old: oldLine.num,
          new: [newLine.num],
          score: simScore,
        });
      } else {
        // aligned in DP, but not similar enough to count as a real match
        mappingByOldNum.set(oldLine.num, {
          old: oldLine.num,
          new: [],
          score: simScore,
        });
      }

      i -= 1;
      j -= 1;
    } else if (ch === "DEL") {
      const oldLine = oldLines[i - 1];
      mappingByOldNum.set(oldLine.num, {
        old: oldLine.num,
        new: [],
        score: 0,
      });
      i -= 1;
    } else if (ch === "INS") {
      // New-only line: consumes j but doesn't create an old->new mapping
      j -= 1;
    } else {
      // Fallback safety: treat as delete if something unexpected happens
      if (i > 0) {
        const oldLine = oldLines[i - 1];
        mappingByOldNum.set(oldLine.num, {
          old: oldLine.num,
          new: [],
          score: 0,
        });
        i -= 1;
      } else if (j > 0) {
        j -= 1;
      }
    }
  }

  // Ensure every old line has an entry (in case something was skipped)
  for (const oldLine of oldLines) {
    if (!mappingByOldNum.has(oldLine.num)) {
      mappingByOldNum.set(oldLine.num, {
        old: oldLine.num,
        new: [],
        score: 0,
      });
    }
  }

  const result = Array.from(mappingByOldNum.values());
  result.sort((a, b) => a.old - b.old);
  return result;
}

/**
 * Build a simple context window of neighbours' normalized text.
 */
function getContext(lines, lineNum, radius) {
  const idx = lineNum - 1;
  const ctx = [];
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
