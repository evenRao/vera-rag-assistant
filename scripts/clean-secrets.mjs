import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = [
  path.join(rootDir, "backend", ".env"),
  path.join(rootDir, "frontend", ".env.local"),
];

for (const filePath of files) {
  await removeFile(filePath);
}

async function removeFile(filePath) {
  try {
    await fs.access(filePath);
    await fs.rm(filePath, { force: true });
    console.log(`Removed ${path.relative(rootDir, filePath)}`);
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log(`Not found ${path.relative(rootDir, filePath)}`);
      return;
    }

    console.error(`Could not remove ${path.relative(rootDir, filePath)}: ${error.message}`);
    process.exitCode = 1;
  }
}
