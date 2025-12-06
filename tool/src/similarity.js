// similarity.js

/**
 * Jaccard similarity over word sets of two normalized strings.
 * Returns a score in [0, 1].
 */
function contentSimilarity(a, b) {
  if (!a && !b) return 1;
  if (!a || !b) return 0;

  const tokensA = a.split(" ");
  const tokensB = b.split(" ");

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }

  const unionSize = new Set([...tokensA, ...tokensB]).size;
  if (unionSize === 0) return 0;

  // Jaccard index
  return intersection / unionSize;
}

/**
 * Context similarity:
 * - Joins neighbour lines into a single string, then reuses contentSimilarity.
 * - This encourages aligning lines that live in similar neighbourhoods.
 */
function contextSimilarity(ctxA, ctxB) {
  const joinedA = (ctxA || []).join(" ");
  const joinedB = (ctxB || []).join(" ");
  return contentSimilarity(joinedA, joinedB);
}

/**
 * Combined similarity:
 * - Emphasizes the actual line content.
 * - Uses a smaller weight for context to reduce weird matches when
 *   the neighbourhood is noisy.
 */
function combinedSimilarity(contentSim, contextSim) {
  const wContent = 0.7;
  const wContext = 0.3;
  return wContent * contentSim + wContext * contextSim;
}

module.exports = {
  contentSimilarity,
  contextSimilarity,
  combinedSimilarity,
};
