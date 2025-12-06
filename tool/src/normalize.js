// normalize.js

function normalizeLineText(text) {
    if (!text) return "";
    const trimmed = text.trim();
    const collapsed = trimmed.replace(/\s+/g, " ");
    const lower = collapsed.toLowerCase();
    return lower;
  }
  
  function normalizeLines(lines) {
    return lines.map((line) => ({
      ...line,
      norm: normalizeLineText(line.text),
    }));
  }
  
  module.exports = {
    normalizeLineText,
    normalizeLines,
  };
  