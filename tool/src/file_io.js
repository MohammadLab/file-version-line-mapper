// file_io.js
const fs = require("fs");

/**
 * @param {string} filePath
 * @returns {Array<{ num: number, text: string }>}
 */
function readFileLines(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const rawLines = content.split(/\r?\n/);

  return rawLines.map((line, idx) => ({
    num: idx + 1, // 1-based
    text: line,
  }));
}

module.exports = {
  readFileLines,
};
