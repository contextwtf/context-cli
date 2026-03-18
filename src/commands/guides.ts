// ---------------------------------------------------------------------------
// Guides command — render skill markdown files in the terminal
// ---------------------------------------------------------------------------

import { readFileSync, readdirSync } from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";
import { fail, type ParsedArgs } from "../format.js";

// When bundled by tsup into dist/cli.js, resolve skills/ relative to the package root.
// import.meta.url gives us the location of the running script (dist/cli.js).
const SKILLS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../skills");

/** Map of guide slug -> { description, file } */
function loadGuideIndex(): Map<string, { description: string; file: string }> {
  const guides = new Map<string, { description: string; file: string }>();
  let files: string[];
  try {
    files = readdirSync(SKILLS_DIR).filter((f) => f.endsWith(".md"));
  } catch {
    return guides;
  }

  for (const file of files) {
    const slug = basename(file, ".md");
    const content = readFileSync(join(SKILLS_DIR, file), "utf-8");
    const descMatch = content.match(/^description:\s*(.+)$/m);
    const description = descMatch ? descMatch[1].trim() : "";
    guides.set(slug, { description, file });
  }
  return guides;
}

/** Render markdown with minimal chalk formatting */
function renderMarkdown(content: string): string {
  const lines = content.split("\n");
  const output: string[] = [];
  let inFrontmatter = false;
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trim() === "---") {
      inFrontmatter = !inFrontmatter;
      continue;
    }
    if (inFrontmatter) continue;

    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      if (inCodeBlock) {
        output.push(chalk.dim("  \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500"));
      } else {
        output.push(chalk.dim("  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500"));
      }
      continue;
    }

    if (inCodeBlock) {
      output.push(chalk.dim("  \u2502 ") + line);
      continue;
    }

    if (line.startsWith("# ")) {
      output.push("");
      output.push(chalk.bold(line.slice(2)));
      output.push("");
      continue;
    }
    if (line.startsWith("## ")) {
      output.push("");
      output.push(chalk.bold(line.slice(3)));
      output.push(chalk.dim("\u2500".repeat(line.length - 3)));
      continue;
    }
    if (line.startsWith("### ")) {
      output.push("");
      output.push(chalk.bold.dim(line.slice(4)));
      continue;
    }

    output.push(line);
  }

  return output.join("\n");
}

export default async function handleGuides(parsed: ParsedArgs): Promise<void> {
  const topic = parsed.subcommand;
  const guides = loadGuideIndex();

  if (!topic) {
    console.log();
    console.log(chalk.bold("  Available Guides"));
    console.log(chalk.dim("  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500"));
    console.log();
    for (const [slug, info] of guides) {
      console.log(
        `  ${chalk.bold(slug.padEnd(20))} ${chalk.dim(info.description)}`,
      );
    }
    console.log();
    console.log(chalk.dim("  Usage: context guides <topic>"));
    console.log();
    return;
  }

  const guide = guides.get(topic);
  if (!guide) {
    fail(
      `Unknown guide: "${topic}". Run "context guides" to see available guides.`,
    );
  }

  const content = readFileSync(join(SKILLS_DIR, guide!.file), "utf-8");
  console.log(renderMarkdown(content));
}
