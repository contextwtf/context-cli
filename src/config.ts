// ---------------------------------------------------------------------------
// Config file support — ~/.config/context/config.env
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const CONFIG_DIR = join(homedir(), ".config", "context");
const CONFIG_FILE = join(CONFIG_DIR, "config.env");

/** Parse a simple KEY=VALUE env file. Skips comments and blank lines. */
export function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx);
    let value = trimmed.slice(eqIdx + 1);
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

/** Serialize key-value pairs to env file format. */
export function serializeEnvFile(data: Record<string, string>): string {
  return Object.entries(data)
    .map(([k, v]) => `${k}="${v}"`)
    .join("\n") + "\n";
}

/** Load config from ~/.config/context/config.env. Returns empty object if missing. */
export function loadConfig(): Record<string, string> {
  try {
    return parseEnvFile(readFileSync(CONFIG_FILE, "utf-8"));
  } catch {
    return {};
  }
}

/** Save config values to ~/.config/context/config.env. Merges with existing. */
export function saveConfig(values: Record<string, string>): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  const existing = loadConfig();
  const merged = { ...existing, ...values };
  writeFileSync(CONFIG_FILE, serializeEnvFile(merged), { mode: 0o600 });
}

/** Get the config file path (for display to user). */
export function configPath(): string {
  return CONFIG_FILE;
}
