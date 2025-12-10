#!/usr/bin/env node

// map_lines.js
const file = require("fs");
const path = require("path");
const { mapFiles } = require("./mapper");

function printUsage() {
  console.log("Usage: node map_lines.js <oldFile> <newFile> [outputFile]");
  console.log("Example: node map_lines.js old.txt new.txt mapping.json");
}

async function main() {
  const [, , oldPathArg, newPathArg, outPathArg] = process.argv;

  if (!oldPathArg || !newPathArg) {
    console.error("Error: missing arguments.");
    printUsage();
    process.exit(1);
  }

  const oldPath = path.resolve(oldPathArg);
  const newPath = path.resolve(newPathArg);
  const outPath = outPathArg
    ? path.resolve(outPathArg)
    : path.resolve(__dirname, "..", "mapping.json");

  try {
    const mappings = await mapFiles(oldPath, newPath);
    file.writeFileSync(outPath, JSON.stringify(mappings));
  } catch (err) {
    console.error("Error while mapping files:", err.message || err);
    process.exit(1);
  }
}

main();
