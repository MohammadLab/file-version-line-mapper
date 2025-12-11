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
  const usedOldNums = new Set();
  const usedNewNums = new Set();

  const TRIVIAL_CONTEXT_RADIUS = 2;
  const TRIVIAL_CTX_THRESHOLD = 0.1;

  for (const oldline of oldLines) {
    for (const newline of newLines) {
      const isOldTrivial = isTrivialLine(oldline);
      const isNewTrivial = isTrivialLine(newline);
      const bothTrivial = isOldTrivial && isNewTrivial;

      if (bothTrivial) {
        oldline.norm = oldline.norm.trim();
        newline.norm = newline.norm.trim();
      }

      if (
        oldline.norm === newline.norm &&
        !usedOldNums.has(oldline.num) &&
        !usedNewNums.has(newline.num)
      ) {
        if (bothTrivial) {
          const ctxOld = getContext(
            oldLines,
            oldline.num,
            TRIVIAL_CONTEXT_RADIUS
          );
          const ctxNew = getContext(
            newLines,
            newline.num,
            TRIVIAL_CONTEXT_RADIUS
          );

          const ctxSim = contextSimilarity(ctxOld, ctxNew);

          if (ctxSim < TRIVIAL_CTX_THRESHOLD) {
            continue;
          }

          matchSet.push({
            old: oldline.num,
            new: [newline.num],
            status: "trivial_match",
            score: 1,
          });
        } else {
          matchSet.push({
            old: oldline.num,
            new: [newline.num],
            status: "match",
            score: 1,
          });
        }

        usedOldNums.add(oldline.num);
        usedNewNums.add(newline.num);
      }
    }
  }

  const oldLinesNoMatch = oldLines.filter((l) => !usedOldNums.has(l.num));
  const newLinesNoMatch = newLines.filter((l) => !usedNewNums.has(l.num));

  const TOP_K = 15;
  const SIM_THRESHOLD = 0.25;
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

    const dominantOffset = getDominantOffset(matchSet, oldline.num, 10);

    for (const newline of newLinesNoMatch) {
      if (usedNewNums.has(newline.num)) continue;
      if (isTrivialLine(newline)) continue;

      const ctxNew = getContext(newLines, newline.num, CONTEXT_RADIUS);

      const contentSim = contentSimilarity(oldline.norm, newline.norm);
      const ctxSim = contextSimilarity(ctxOld, ctxNew);

      let score = combinedSimilarity(contentSim, ctxSim);

      if (dominantOffset != null && contentSim < 0.2 && ctxSim > 0) {
        const expectedNew = oldline.num + dominantOffset;
        const dist = Math.abs(newline.num - expectedNew);
        const MAX_DIST = 10;
        const locBoost = Math.max(0, (MAX_DIST - dist) / MAX_DIST);

        score += 0.2 * locBoost;
      }

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
    if (usedOldNums.has(oldline.num)) continue;

    if (isTrivialLine(oldline)) continue;

    usedOldNums.add(oldline.num);
    matchSet.push({
      old: oldline.num,
      new: [],
      status: "unmatched",
      score: 0,
    });
  }

  let newMatchSet = improveManyToOneMatches(oldLines, newLines, matchSet);

  newMatchSet = refineSplitMatches(oldLines, newLines, newMatchSet);

  newMatchSet.sort((a, b) => a.old - b.old);
  return newMatchSet;
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

function getDominantOffset(matchSet, oldNum, radius = 10) {
  const counts = new Map();

  for (const m of matchSet) {
    if (!m.new || m.new.length !== 1) continue;

    const old = m.old;
    const nu = m.new[0];

    if (Math.abs(old - oldNum) > radius) continue;

    const delta = nu - old;
    const prev = counts.get(delta) || 0;
    counts.set(delta, prev + 1);
  }

  let bestDelta = null;
  let bestCount = 0;

  for (const [delta, count] of counts.entries()) {
    if (count > bestCount) {
      bestCount = count;
      bestDelta = delta;
    }
  }

  return bestDelta;
}

function improveManyToOneMatches(oldLines, newLines, matchSet) {
  const oldIndex = new Map();
  for (const l of oldLines) {
    oldIndex.set(l.num, l);
  }
  const newIndex = new Map();
  for (const l of newLines) {
    newIndex.set(l.num, l);
  }

  const newToOlds = new Map();
  for (const m of matchSet) {
    if (!Array.isArray(m.new)) {
      m.new = m.new == null ? [] : [m.new];
    }
    for (const n of m.new) {
      if (!newToOlds.has(n)) newToOlds.set(n, []);
      newToOlds.get(n).push(m.old);
    }
  }

  const oldToEntry = new Map();
  for (const m of matchSet) {
    oldToEntry.set(m.old, m);
  }

  const isUnmatched = (oldNum) => {
    const e = oldToEntry.get(oldNum);
    return !e || !e.new || e.new.length === 0;
  };

  const BLOCK_MAX_OLD_PER_NEW = 12;
  const BLOCK_EXPAND_RADIUS = 5;
  const BLOCK_MIN_SCORE = 0.1;

  for (const [n, olds] of newToOlds.entries()) {
    if (!olds || olds.length === 0 || olds.length > BLOCK_MAX_OLD_PER_NEW) {
      continue;
    }

    const sortedOlds = [...olds].sort((a, b) => a - b);

    for (const anchorOld of sortedOlds) {
      const anchorEntry = oldToEntry.get(anchorOld);
      if (
        !anchorEntry ||
        !Array.isArray(anchorEntry.new) ||
        anchorEntry.new.length !== 1
      ) {
        continue;
      }

      const anchorLine = oldIndex.get(anchorOld);
      const newLine = newIndex.get(n);
      if (!anchorLine || !newLine) continue;

      const baseContent = contentSimilarity(anchorLine.norm, newLine.norm);
      const baseCtx = contextSimilarity(
        getContext(oldLines, anchorOld, 2),
        getContext(newLines, n, 2)
      );
      const baseScore = combinedSimilarity(baseContent, baseCtx);

      const localMin = Math.max(BLOCK_MIN_SCORE, 0.3 * baseScore);

      for (const direction of [-1, +1]) {
        let i = anchorOld + direction;
        let steps = 0;

        while (steps < BLOCK_EXPAND_RADIUS && oldIndex.has(i)) {
          steps++;
          if (olds.includes(i)) {
            i += direction;
            continue;
          }

          if (!isUnmatched(i)) {
            break;
          }

          const oldLine = oldIndex.get(i);
          if (!oldLine || isTrivialLine(oldLine)) {
            i += direction;
            continue;
          }

          const contentSim = contentSimilarity(oldLine.norm, newLine.norm);
          const ctxSim = contextSimilarity(
            getContext(oldLines, i, 2),
            getContext(newLines, n, 2)
          );
          const score = combinedSimilarity(contentSim, ctxSim);

          if (score < localMin) {
            break;
          }

          let entry = oldToEntry.get(i);
          if (entry) {
            entry.new = [n];
            entry.status = "match";
            entry.score = score;
          } else {
            entry = {
              old: i,
              new: [n],
              status: "match",
              score,
            };
            matchSet.push(entry);
            oldToEntry.set(i, entry);
          }

          olds.push(i);
          if (!newToOlds.get(n).includes(i)) {
            newToOlds.get(n).push(i);
          }

          i += direction;
        }
      }
    }
  }

  return matchSet;
}

function refineSplitMatches(oldLines, newLines, matchSet) {
  if (!matchSet || !Array.isArray(matchSet)) return matchSet || [];

  const oldIndex = new Map(oldLines.map((l) => [l.num, l]));
  const newIndex = new Map(newLines.map((l) => [l.num, l]));

  for (const entry of matchSet) {
    if (
      !entry ||
      entry.status !== "match_split" ||
      !Array.isArray(entry.new) ||
      entry.new.length <= 1
    ) {
      continue;
    }

    const oldLine = oldIndex.get(entry.old);
    if (!oldLine || !oldLine.norm) continue;

    const oldNorm = oldLine.norm;

    let bestNewNum = null;
    let bestContentSim = -1;

    for (const newNum of entry.new) {
      const newLine = newIndex.get(newNum);
      if (!newLine || !newLine.norm) continue;

      const cs = contentSimilarity(oldNorm, newLine.norm);
      if (cs > bestContentSim) {
        bestContentSim = cs;
        bestNewNum = newNum;
      }
    }

    if (bestNewNum == null) continue;

    const ctxRadius = 2;
    const ctxOld = getContext(oldLines, entry.old, ctxRadius);
    const ctxNew = getContext(newLines, bestNewNum, ctxRadius);

    const ctxSim = contextSimilarity(
      ctxOld.map((l) => l.norm),
      ctxNew.map((l) => l.norm)
    );
    const combined = combinedSimilarity(bestContentSim, ctxSim);

    entry.new = [bestNewNum];
    entry.status = "match";
    entry.score = combined;
  }

  return matchSet;
}

module.exports = {
  mapFiles,
  mapLines,
};
