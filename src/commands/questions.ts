// ---------------------------------------------------------------------------
// Questions commands — submit questions and poll for AI-generated markets
// ---------------------------------------------------------------------------

import chalk from "chalk";
import { tradingClient, type ClientFlags } from "../client.js";
import {
  out,
  fail,
  requirePositional,
  getOutputMode,
  type ParsedArgs,
} from "../format.js";

const HELP = `Usage: context questions <subcommand> [options]

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
      fail(`Unknown questions subcommand: "${subcommand}". Run "context questions help" for usage.`);
  }
}

// ---------------------------------------------------------------------------
// Shared detail builder for submission responses
// ---------------------------------------------------------------------------

function submissionDetail(r: any): [string, string][] {
  const questions = (r.questions || []) as { id: string; text?: string }[];
  const similarMarkets = (r.similarMarkets || []) as {
    id: string;
    question: string;
    shortQuestion: string;
    similarity: number;
  }[];
  const rejections = (r.rejectionReasons || []) as {
    code: string;
    message: string;
  }[];

  return [
    ["Submission ID", String(r.submissionId || "—")],
    ["Status", String(r.status || "—")],
    ...questions.flatMap((q, i) => [
      [`Question ${i + 1}`, q.text || "—"] as [string, string],
      [`  Market ID`, q.id] as [string, string],
    ]),
    ...(r.statusUpdates?.length
      ? [["Latest Update", String((r.statusUpdates as any[]).at(-1)?.status || "—")] as [string, string]]
      : []),
    ...similarMarkets.flatMap((m, i) => [
      [`Similar ${i + 1}`, `${m.shortQuestion || m.question} (${Math.round(m.similarity * 100)}% match)`] as [string, string],
      [`  Market ID`, m.id] as [string, string],
    ]),
    ...rejections.map((r) => [`Rejected`, `[${r.code}] ${r.message}`] as [string, string]),
    ...(r.qualityExplanation ? [["Quality", String(r.qualityExplanation)] as [string, string]] : []),
    ...(r.refuseToResolve ? [["Warning", "Marked as unresolvable"] as [string, string]] : []),
    ...(r.appliedChanges?.length
      ? r.appliedChanges.map((c: string) => ["Change Applied", c] as [string, string])
      : []),
  ];
}

// ---------------------------------------------------------------------------
// submit — submit a question for AI generation
// ---------------------------------------------------------------------------

async function submit(
  positional: string[],
  flags: Record<string, string>,
): Promise<void> {
  const question = requirePositional(positional, 0, "question", "context questions submit <question>");
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
  const submissionId = requirePositional(positional, 0, "submissionId", "context questions status <submissionId>");
  const ctx = tradingClient(flags as ClientFlags);

  const result = await ctx.questions.getSubmission(submissionId);
  const r = result as any;
  out(result, { detail: submissionDetail(r) });
}

// ---------------------------------------------------------------------------
// submit-and-wait — submit and poll until complete
// ---------------------------------------------------------------------------

async function submitAndWait(
  positional: string[],
  flags: Record<string, string>,
): Promise<void> {
  const question = requirePositional(positional, 0, "question", "context questions submit-and-wait <question>");
  const ctx = tradingClient(flags as ClientFlags);

  const opts = {
    pollIntervalMs: flags["poll-interval"] ? parseInt(flags["poll-interval"], 10) : undefined,
    maxAttempts: flags["max-attempts"] ? parseInt(flags["max-attempts"], 10) : undefined,
  };

  let result: any;

  if (getOutputMode() === "table") {
    const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    let i = 0;
    const timer = setInterval(() => {
      process.stderr.write(`\r${chalk.cyan(frames[i++ % frames.length])} Submitting question and waiting for AI generation...`);
    }, 80);
    try {
      result = await ctx.questions.submitAndWait(question, opts);
      clearInterval(timer);
      process.stderr.write(`\r${chalk.green("✓")} Question processed!                                      \n`);
    } catch (err) {
      clearInterval(timer);
      process.stderr.write(`\r${chalk.red("✗")} Failed.                                                  \n`);
      throw err;
    }
  } else {
    result = await ctx.questions.submitAndWait(question, opts);
  }

  out(result, { detail: submissionDetail(result as any) });
}
