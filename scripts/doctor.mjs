import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";
const uvCommand = isWindows ? "uv.exe" : "uv";

const backendEnvPath = path.join(rootDir, "backend", ".env");
const frontendEnvPath = path.join(rootDir, "frontend", ".env.local");

const nodeFound = commandFound("node", ["--version"]);
const npmFound = commandFound(npmCommand, ["--version"]);
const uvFound = commandFound(uvCommand, ["--version"]);
const backendEnvFound = fs.existsSync(backendEnvPath);
const backendEnv = backendEnvFound ? parseEnv(fs.readFileSync(backendEnvPath, "utf8")) : {};
const frontendEnvFound = fs.existsSync(frontendEnvPath);
const frontendEnv = frontendEnvFound ? parseEnv(fs.readFileSync(frontendEnvPath, "utf8")) : {};
const openaiKeyFound = Boolean(
  backendEnv.OPENAI_API_KEY && backendEnv.OPENAI_API_KEY !== "your_openai_api_key_here",
);
const frontendApiBaseFound = Boolean(frontendEnv.NEXT_PUBLIC_API_BASE_URL);
const backendPyprojectFound = fs.existsSync(path.join(rootDir, "backend", "pyproject.toml"));
const frontendPackageFound = fs.existsSync(path.join(rootDir, "frontend", "package.json"));
const chromaDbFound = fs.existsSync(path.join(rootDir, "backend", "chroma_db"));

const ready =
  nodeFound &&
  npmFound &&
  uvFound &&
  backendEnvFound &&
  openaiKeyFound &&
  frontendEnvFound &&
  frontendApiBaseFound &&
  backendPyprojectFound &&
  frontendPackageFound;

console.log("VERA Doctor");
printStatus("Node", nodeFound);
printStatus("npm", npmFound);
printStatus("uv", uvFound);
printStatus("backend/.env", backendEnvFound);
printStatus("OPENAI_API_KEY", openaiKeyFound);
printStatus("frontend/.env.local", frontendEnvFound);
printStatus("NEXT_PUBLIC_API_BASE_URL", frontendApiBaseFound);
printStatus("backend/pyproject.toml", backendPyprojectFound);
printStatus("frontend/package.json", frontendPackageFound);
printStatus("Chroma DB", chromaDbFound);
console.log(`Status: ${ready ? "ready" : "needs setup"}`);
console.log(`Run: ${ready ? "npm run dev" : "npm run setup"}`);

function commandFound(command, args) {
  const useShell = isWindows && command.toLowerCase().endsWith(".cmd");
  const result = spawnSync(useShell ? commandLine(command, args) : command, useShell ? [] : args, {
    stdio: "ignore",
    shell: useShell,
  });
  return result.status === 0;
}

function commandLine(command, args) {
  return [command, ...args].map(shellQuote).join(" ");
}

function shellQuote(value) {
  if (!/[\s"&|<>]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '\\"')}"`;
}

function printStatus(label, found) {
  console.log(`${label}: ${found ? "found" : "missing"}`);
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
