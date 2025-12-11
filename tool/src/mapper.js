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
  const TRIVIAL_CTX_THRESHOLD = 0.6;

  for (const oldline of oldLines) {
    for (const newline of newLines) {
      if (
        oldline.norm === newline.norm &&
        !usedOldNums.has(oldline.num) &&
        !usedNewNums.has(newline.num)
      ) {
        const isOldTrivial = isTrivialLine(oldline);
        const isNewTrivial = isTrivialLine(newline);
        const bothTrivial = isOldTrivial && isNewTrivial;

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

    // NEW: learn the dominant local offset from already-matched lines
    const dominantOffset = getDominantOffset(matchSet, oldline.num, 10);

    for (const newline of newLinesNoMatch) {
      if (usedNewNums.has(newline.num)) continue;
      if (isTrivialLine(newline)) continue;

      const ctxNew = getContext(newLines, newline.num, CONTEXT_RADIUS);

      const contentSim = contentSimilarity(oldline.norm, newline.norm);
      const ctxSim = contextSimilarity(ctxOld, ctxNew);

      // base score: content + context, as before
      let score = combinedSimilarity(contentSim, ctxSim);

      // NEW: if content is weak but context is good, use the dominant offset
      // to boost candidates that sit where we "expect" them to be.
      if (dominantOffset != null && contentSim < 0.2 && ctxSim > 0) {
        const expectedNew = oldline.num + dominantOffset;
        const dist = Math.abs(newline.num - expectedNew);
        const MAX_DIST = 10;
        const locBoost = Math.max(0, (MAX_DIST - dist) / MAX_DIST);

        // locality boost is capped and modest so we don't go crazy
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

  const newMatchSet = improveManyToOneMatches(oldLines, newLines, matchSet);

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
    // only consider 1:1 mappings
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
  // index old/new lines by line number
  const oldIndex = new Map();
  for (const l of oldLines) {
    oldIndex.set(l.num, l);
  }
  const newIndex = new Map();
  for (const l of newLines) {
    newIndex.set(l.num, l);
  }

  // normalize shape & build new -> olds mapping
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

  // tuned constants – aggressive enough to fix DoubleCache, but still safe
  const BLOCK_MAX_OLD_PER_NEW = 12; // don't explode on crazy multi-matches
  const BLOCK_EXPAND_RADIUS = 5; // how far from the anchor to expand
  const BLOCK_MIN_SCORE = 0.1; // absolute minimum combinedSim to accept

  for (const [n, olds] of newToOlds.entries()) {
    if (!olds || olds.length === 0 || olds.length > BLOCK_MAX_OLD_PER_NEW) {
      continue;
    }

    // For each anchor old line that maps cleanly to this new line,
    // try to "pull in" adjacent unmatched old lines to the same new line.
    const sortedOlds = [...olds].sort((a, b) => a - b);

    for (const anchorOld of sortedOlds) {
      const anchorEntry = oldToEntry.get(anchorOld);
      if (
        !anchorEntry ||
        !Array.isArray(anchorEntry.new) ||
        anchorEntry.new.length !== 1
      ) {
        continue; // only use single-target anchors, not split matches
      }

      const anchorLine = oldIndex.get(anchorOld);
      const newLine = newIndex.get(n);
      if (!anchorLine || !newLine) continue;

      // Baseline score of the anchor match
      const baseContent = contentSimilarity(anchorLine.norm, newLine.norm);
      const baseCtx = contextSimilarity(
        getContext(oldLines, anchorOld, 2),
        getContext(newLines, n, 2)
      );
      const baseScore = combinedSimilarity(baseContent, baseCtx);

      // Neighbors only need a fraction of the anchor's score, but not below BLOCK_MIN_SCORE
      const localMin = Math.max(BLOCK_MIN_SCORE, 0.3 * baseScore);

      for (const direction of [-1, +1]) {
        let i = anchorOld + direction;
        let steps = 0;

        while (steps < BLOCK_EXPAND_RADIUS && oldIndex.has(i)) {
          steps++;

          // already mapped to this new line? skip
          if (olds.includes(i)) {
            i += direction;
            continue;
          }

          // stop if this old line already has some mapping
          if (!isUnmatched(i)) {
            break;
          }

          const oldLine = oldIndex.get(i);
          if (!oldLine || isTrivialLine(oldLine)) {
            // skip trivial lines but don't necessarily stop the expansion
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
            break; // we hit the edge of the "similar" block
          }

          // Attach this old line to the same new line
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

module.exports = {
  mapFiles,
  mapLines,
};
