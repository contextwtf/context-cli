// ---------------------------------------------------------------------------
// Questions commands — submit questions and poll for AI-generated markets
// ---------------------------------------------------------------------------

import * as p from "@clack/prompts";
import { tradingClient, type ClientFlags } from "../client.js";
import {
  out,
  fail,
  requirePositional,
  getOutputMode,
  type ParsedArgs,
} from "../format.js";
import { formatDate } from "../ui/format.js";

const HELP = `Usage: context-cli questions <subcommand> [options]

Subcommands:
  submit <question>                 Submit a question for AI market generation
  status <submissionId>             Check status of a question submission
  submit-and-wait <question>        Submit and poll until complete
    --poll-interval <ms>              Poll interval in ms (default: 2000)
    --max-attempts <n>                Max poll attempts (default: 45)

  help                              Show this help text

Global options:
  --api-key <key>                   Context API key (or CONTEXT_API_KEY env)
  --private-key <key>               Private key for signing (or CONTEXT_PRIVATE_KEY env)`;

export default async function handleQuestions(
  parsed: ParsedArgs,
): Promise<void> {
  const { subcommand, positional, flags } = parsed;

  switch (subcommand) {
    case "submit":
      return submit(positional, flags);
    case "status":
      return status(positional, flags);
    case "submit-and-wait":
      return submitAndWait(positional, flags);
    case "help":
    case undefined:
      console.log(HELP);
      return;
    default:
      fail(`Unknown questions subcommand: "${subcommand}". Run "context-cli questions help" for usage.`);
  }
}

// ---------------------------------------------------------------------------
// submit — submit a question for AI generation
// ---------------------------------------------------------------------------

async function submit(
  positional: string[],
  flags: Record<string, string>,
): Promise<void> {
  const question = requirePositional(positional, 0, "question", "context-cli questions submit <question>");
  const ctx = tradingClient(flags as ClientFlags);

  const result = await ctx.questions.submit(question);
  const r = result as any;
  out(result, {
    detail: [
      ["Submission ID", String(r.id || r.submissionId || "—")],
      ["Status", String(r.status || "—")],
    ],
  });
}

// ---------------------------------------------------------------------------
// status — check submission status
// ---------------------------------------------------------------------------

async function status(
  positional: string[],
  flags: Record<string, string>,
): Promise<void> {
  const submissionId = requirePositional(positional, 0, "submissionId", "context-cli questions status <submissionId>");
  const ctx = tradingClient(flags as ClientFlags);

  const result = await ctx.questions.getSubmission(submissionId);
  const r = result as any;
  out(result, {
    detail: [
      ["Submission ID", String(r.id || r.submissionId || "—")],
      ["Status", String(r.status || "—")],
      ["Question", String(r.question || "—")],
      ["Created", formatDate(r.createdAt)],
    ],
  });
}

// ---------------------------------------------------------------------------
// submit-and-wait — submit and poll until complete
// ---------------------------------------------------------------------------

async function submitAndWait(
  positional: string[],
  flags: Record<string, string>,
): Promise<void> {
  const question = requirePositional(positional, 0, "question", "context-cli questions submit-and-wait <question>");
  const ctx = tradingClient(flags as ClientFlags);

  const opts = {
    pollIntervalMs: flags["poll-interval"] ? parseInt(flags["poll-interval"], 10) : undefined,
    maxAttempts: flags["max-attempts"] ? parseInt(flags["max-attempts"], 10) : undefined,
  };

  let result: any;

  if (getOutputMode() === "table") {
    const s = p.spinner();
    s.start("Submitting question and waiting for AI generation...");
    result = await ctx.questions.submitAndWait(question, opts);
    s.stop("Question processed!");
  } else {
    result = await ctx.questions.submitAndWait(question, opts);
  }

  out(result, {
    detail: [
      ["Submission ID", String(result.id || result.submissionId || "—")],
      ["Status", String(result.status || "—")],
      ["Question", String(result.question || question)],
      ["Created", formatDate(result.createdAt)],
    ],
  });
}
