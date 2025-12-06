#!/usr/bin/env node

// map_lines.js
const file = require("fs");
const path = require("path");
const { mapFiles } = require("./mapper");

function printUsage() {
  console.log("Usage: node map_lines.js <oldFile> <newFile>");
  console.log("Example: node map_lines.js old.txt new.txt");
}

async function main() {
  const [, , oldPathArg, newPathArg] = process.argv;

  if (!oldPathArg || !newPathArg) {
    console.error("Error: missing arguments.");
    printUsage();
    process.exit(1);
  }

  const oldPath = path.resolve(oldPathArg);
  const newPath = path.resolve(newPathArg);

  try {
    const mappings = await mapFiles(oldPath, newPath);
    file.writeFileSync("../mapping.json", JSON.stringify(mappings));
  } catch (err) {
    console.error("Error while mapping files:", err.message || err);
    process.exit(1);
  }
}

main();
