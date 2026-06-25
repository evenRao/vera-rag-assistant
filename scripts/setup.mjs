import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backendDir = path.join(rootDir, "backend");
const frontendDir = path.join(rootDir, "frontend");
const backendEnvPath = path.join(backendDir, ".env");
const frontendEnvPath = path.join(frontendDir, ".env.local");

const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";
const uvCommand = isWindows ? "uv.exe" : "uv";

async function main() {
  await requireCommand("node", ["--version"], "Node.js is required to run VERA setup.");
  await requireCommand(npmCommand, ["--version"], "npm is required to install VERA frontend dependencies.");
  await requireCommand(
    uvCommand,
    ["--version"],
    "uv is required for the backend. Install it from https://docs.astral.sh/uv/ and rerun npm run setup.",
  );

  await ensureRootDependencies();
  await ensureBackendEnv();
  await ensureFrontendEnv();

  await run(uvCommand, ["sync"], { cwd: backendDir });
  await run(npmCommand, ["install"], { cwd: frontendDir });

  console.log("");
  console.log("Setup complete.");
  console.log("Run: npm run dev");
  console.log("Frontend: http://localhost:3000");
  console.log("Backend: http://localhost:8000");
}

async function requireCommand(command, args, message) {
  const result = await run(command, args, { quiet: true, reject: false });
  if (result !== 0) {
    console.error(message);
    process.exit(1);
  }
}

async function ensureRootDependencies() {
  const concurrentlyBin = path.join(
    rootDir,
    "node_modules",
    ".bin",
    isWindows ? "concurrently.cmd" : "concurrently",
  );

  if (await exists(concurrentlyBin)) {
    return;
  }

  console.log("Installing root developer dependencies...");
  await run(npmCommand, ["install"], { cwd: rootDir });
}

async function ensureBackendEnv() {
  const envValues = parseEnv(await readOptionalFile(backendEnvPath));
  const existingKey = envValues.OPENAI_API_KEY;
  const hasUsableKey = Boolean(existingKey && existingKey !== "your_openai_api_key_here");

  let openaiApiKey = existingKey ?? "";
  if (hasUsableKey) {
    const keepExisting = await askYesNo(
      "backend/.env already has OPENAI_API_KEY. Keep existing key? [Y/n] ",
      true,
    );
    if (!keepExisting) {
      openaiApiKey = await askSecret("Enter your OpenAI API key: ");
    }
  } else {
    openaiApiKey = await askSecret("Enter your OpenAI API key: ");
  }

  if (!openaiApiKey.trim()) {
    console.error("OPENAI_API_KEY is required. Setup stopped.");
    process.exit(1);
  }

  const updatedValues = {
    ...envValues,
    OPENAI_API_KEY: openaiApiKey.trim(),
    CHROMA_DB_DIR: envValues.CHROMA_DB_DIR || "./chroma_db",
    RELEVANCE_THRESHOLD: envValues.RELEVANCE_THRESHOLD || "1.40",
    SOURCE_DISPLAY_THRESHOLD: envValues.SOURCE_DISPLAY_THRESHOLD || "0.47",
  };
  await writeEnv(backendEnvPath, updatedValues, [
    "OPENAI_API_KEY",
    "CHROMA_DB_DIR",
    "RELEVANCE_THRESHOLD",
    "SOURCE_DISPLAY_THRESHOLD",
  ]);
}

async function ensureFrontendEnv() {
  const envValues = parseEnv(await readOptionalFile(frontendEnvPath));
  envValues.NEXT_PUBLIC_API_BASE_URL =
    envValues.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  await writeEnv(frontendEnvPath, envValues, ["NEXT_PUBLIC_API_BASE_URL"]);
}

async function askYesNo(question, defaultValue) {
  const rl = createInterface({ input, output });
  const answer = (await rl.question(question)).trim().toLowerCase();
  rl.close();

  if (!answer) {
    return defaultValue;
  }

  return answer === "y" || answer === "yes";
}

async function askSecret(question) {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    const rl = createInterface({ input, output });
    const answer = await rl.question(question);
    rl.close();
    return answer;
  }

  output.write(question);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  let value = "";
  return await new Promise((resolve) => {
    function onData(character) {
      if (character === "\u0003") {
        process.stdin.setRawMode(false);
        process.stdin.off("data", onData);
        output.write("\n");
        process.exit(130);
      }

      if (character === "\r" || character === "\n") {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.off("data", onData);
        output.write("\n");
        resolve(value);
        return;
      }

      if (character === "\u0008" || character === "\u007f") {
        value = value.slice(0, -1);
        return;
      }

      value += character;
    }

    process.stdin.on("data", onData);
  });
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

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim();
    values[key] = value;
  }

  return values;
}

async function writeEnv(filePath, values, preferredOrder) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const keys = [
    ...preferredOrder,
    ...Object.keys(values).filter((key) => !preferredOrder.includes(key)).sort(),
  ];
  const lines = keys
    .filter((key) => values[key] !== undefined && values[key] !== "")
    .map((key) => `${key}=${values[key]}`);
  await fs.writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
}

async function readOptionalFile(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return "";
    }

    throw error;
  }
}

async function exists(filePath) {
  try {
    await fs.access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function run(command, args, options = {}) {
  const useShell = shouldUseShell(command);
  const child = spawn(useShell ? commandLine(command, args) : command, useShell ? [] : args, {
    cwd: options.cwd || rootDir,
    shell: useShell,
    stdio: options.quiet ? "ignore" : "inherit",
  });

  return await new Promise((resolve, reject) => {
    child.on("error", (error) => {
      if (options.reject === false) {
        resolve(1);
        return;
      }
      reject(error);
    });
    child.on("exit", (code) => {
      const exitCode = code ?? 1;
      if (exitCode !== 0 && options.reject !== false) {
        reject(new Error(`${command} ${args.join(" ")} exited with code ${exitCode}`));
        return;
      }
      resolve(exitCode);
    });
  });
}

function shouldUseShell(command) {
  return isWindows && command.toLowerCase().endsWith(".cmd");
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

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
