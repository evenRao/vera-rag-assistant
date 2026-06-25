import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const checks = [
  {
    filePath: path.join(rootDir, "backend", ".env"),
    key: "OPENAI_API_KEY",
  },
  {
    filePath: path.join(rootDir, "frontend", ".env.local"),
    key: "NEXT_PUBLIC_API_BASE_URL",
  },
];

const missing = checks.some(({ filePath, key }) => {
  if (!fs.existsSync(filePath)) {
    return true;
  }

  const values = parseEnv(fs.readFileSync(filePath, "utf8"));
  return !values[key] || values[key] === "your_openai_api_key_here";
});

if (missing) {
  console.error("Missing local configuration. Run npm run setup first.");
  process.exit(1);
}

function parseEnv(content) {
  const values = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }

    values[trimmed.slice(0, equalsIndex).trim()] = trimmed
      .slice(equalsIndex + 1)
      .trim();
  }

  return values;
}
