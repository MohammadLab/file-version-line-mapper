// file_io.js
const fs = require("fs");

/**
 * @param {string} filePath
 * @returns {Array<{ num: number, text: string }>}
 */
function readFileLines(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const normalized = content
    .replace(/\r\n/g, "\n") // Windows CRLF -> \n
    .replace(/\r/g, "\n"); // stray CR -> \n

  const rawLines = normalized.split("\n");

  return rawLines.map((line, idx) => ({
    num: idx + 1, // 1-based physical line number
    text: line,
  }));
}

module.exports = {
  readFileLines,
};
