import fs from "fs";
import path from "path";

let isLoaded = false;

export function loadEnv(): void {
  if (isLoaded) {
    return;
  }

  const envPath = path.resolve(__dirname, "../../.env");
  if (!fs.existsSync(envPath)) {
    isLoaded = true;
    return;
  }

  const envFile = fs.readFileSync(envPath, "utf8");
  for (const rawLine of envFile.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (!process.env[key]) {
      process.env[key] = stripWrappingQuotes(value);
    }
  }

  isLoaded = true;
}

function stripWrappingQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
