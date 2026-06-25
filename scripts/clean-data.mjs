import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chromaDbPath = path.join(rootDir, "backend", "chroma_db");

try {
  await fs.access(chromaDbPath);
  await fs.rm(chromaDbPath, { recursive: true, force: true });
  console.log(`Removed ${path.relative(rootDir, chromaDbPath)}`);
} catch (error) {
  if (error.code === "ENOENT") {
    console.log(`Not found ${path.relative(rootDir, chromaDbPath)}`);
    process.exit(0);
  }

  console.error(`Could not remove ${path.relative(rootDir, chromaDbPath)}: ${error.message}`);
  process.exitCode = 1;
}
