// ---------------------------------------------------------------------------
// Questions commands — submit questions and poll for AI-generated markets
// ---------------------------------------------------------------------------

import chalk from "chalk";
import type {
  AgentSubmitMarketDraft,
  QuestionSubmission,
  SubmitQuestionResult,
} from "context-markets";
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
  agent-submit                      Submit a fully-formed market draft directly
    --formatted-question <text>       Full question text (required)
    --short-question <text>           Short display title (required)
    --market-type <type>              SUBJECTIVE or OBJECTIVE (required)
    --evidence-mode <mode>            social_only or web_enabled (required)
    --resolution-criteria <text>      How the market should resolve (required)
    --end-time <datetime>             End time as "YYYY-MM-DD HH:MM:SS" (required)
    --timezone <tz>                   IANA timezone (default: America/New_York)
    --sources <urls>                  Comma-separated source URLs
    --explanation <text>              Brief explanation (max 120 chars)
  agent-submit-and-wait             Same as agent-submit but polls until complete
    (same flags as agent-submit, plus:)
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
    case "agent-submit":
      return agentSubmit(flags);
    case "agent-submit-and-wait":
      return agentSubmitAndWait(flags);
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

function submissionDetail(r: QuestionSubmission): [string, string][] {
  const latestUpdate = r.statusUpdates.at(-1);

  return [
    ["Submission ID", String(r.submissionId || "—")],
    ["Status", String(r.status || "—")],
    ...r.questions.flatMap((q, i) => [
      [`Question ${i + 1}`, q.text || "—"] as [string, string],
      [`  Market ID`, q.id] as [string, string],
    ]),
    ...(latestUpdate
      ? [["Latest Update", String(latestUpdate.status || "—")] as [string, string]]
      : []),
    ...(r.similarMarkets || []).flatMap((m, i) => [
      [`Similar ${i + 1}`, `${m.shortQuestion || m.question} (${Math.round(m.similarity * 100)}% match)`] as [string, string],
      [`  Market ID`, m.id] as [string, string],
    ]),
    ...(r.rejectionReasons || []).map((reason) => [`Rejected`, `[${reason.code}] ${reason.message}`] as [string, string]),
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

  const result: SubmitQuestionResult = await ctx.questions.submit(question);
  out(result, {
    detail: [
      ["Submission ID", String(result.submissionId || "—")],
      ["Status", String(result.status || "—")],
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

  const result: QuestionSubmission = await ctx.questions.getSubmission(submissionId);
  out(result, { detail: submissionDetail(result) });
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

  let result: QuestionSubmission;

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

  out(result, { detail: submissionDetail(result) });
}

// ---------------------------------------------------------------------------
// agent-submit helpers
// ---------------------------------------------------------------------------

function parseAgentSubmitFlags(flags: Record<string, string>): AgentSubmitMarketDraft {
  const formattedQuestion = flags["formatted-question"];
  const shortQuestion = flags["short-question"];
  const marketType = flags["market-type"] as "SUBJECTIVE" | "OBJECTIVE";
  const evidenceMode = flags["evidence-mode"] as "social_only" | "web_enabled";
  const resolutionCriteria = flags["resolution-criteria"];
  const endTime = flags["end-time"];

  if (!formattedQuestion || !shortQuestion || !marketType || !evidenceMode || !resolutionCriteria || !endTime) {
    fail("Required flags: --formatted-question, --short-question, --market-type, --evidence-mode, --resolution-criteria, --end-time");
  }

  return {
    market: {
      formattedQuestion,
      shortQuestion,
      marketType,
      evidenceMode,
      resolutionCriteria,
      endTime,
      timezone: flags["timezone"] || "America/New_York",
      sources: flags["sources"] ? flags["sources"].split(",").map(s => s.trim()) : undefined,
      explanation: flags["explanation"],
    },
  };
}

// ---------------------------------------------------------------------------
// agent-submit — submit a fully-formed market draft directly
// ---------------------------------------------------------------------------

async function agentSubmit(
  flags: Record<string, string>,
): Promise<void> {
  const draft = parseAgentSubmitFlags(flags);
  const ctx = tradingClient(flags as ClientFlags);
  const result: SubmitQuestionResult = await ctx.questions.agentSubmit(draft);
  out(result, {
    detail: [
      ["Submission ID", String(result.submissionId || "—")],
    ],
  });
}

// ---------------------------------------------------------------------------
// agent-submit-and-wait — submit draft and poll until complete
// ---------------------------------------------------------------------------

async function agentSubmitAndWait(
  flags: Record<string, string>,
): Promise<void> {
  const draft = parseAgentSubmitFlags(flags);
  const ctx = tradingClient(flags as ClientFlags);

  const opts = {
    pollIntervalMs: flags["poll-interval"] ? parseInt(flags["poll-interval"], 10) : undefined,
    maxAttempts: flags["max-attempts"] ? parseInt(flags["max-attempts"], 10) : undefined,
  };

  let result: QuestionSubmission;

  if (getOutputMode() === "table") {
    const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    let i = 0;
    const timer = setInterval(() => {
      process.stderr.write(`\r${chalk.cyan(frames[i++ % frames.length])} Submitting market draft and waiting for processing...`);
    }, 80);
    try {
      result = await ctx.questions.agentSubmitAndWait(draft, opts);
      clearInterval(timer);
      process.stderr.write(`\r${chalk.green("✓")} Market draft processed!                                      \n`);
    } catch (err) {
      clearInterval(timer);
      process.stderr.write(`\r${chalk.red("✗")} Failed.                                                  \n`);
      throw err;
    }
  } else {
    result = await ctx.questions.agentSubmitAndWait(draft, opts);
  }

  out(result, { detail: submissionDetail(result) });
}
