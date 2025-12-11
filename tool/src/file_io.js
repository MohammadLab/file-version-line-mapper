const fs = require("fs");

function readFileLines(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const rawLines = normalized.split("\n");

  return rawLines.map((line, idx) => ({
    num: idx + 1,
    text: line,
  }));
}

module.exports = {
  readFileLines,
};
