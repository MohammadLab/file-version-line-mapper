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

  return intersection / unionSize;
}

function contextSimilarity(ctxA, ctxB) {
  const joinedA = (ctxA || []).join(" ");
  const joinedB = (ctxB || []).join(" ");
  return contentSimilarity(joinedA, joinedB);
}

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
