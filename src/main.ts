import * as fs from "node:fs";
import * as path from "node:path";
import * as core from "@actions/core";
import * as github from "@actions/github";
import {
  buildCycloneDx,
  componentsFromPackageLock,
  componentsFromPnpmLock,
  componentsFromYarnLock,
  formatSbomSummary,
} from "./rules";

const MARKER = "<!-- simple-sbom-report -->";
const NAME = "Simple SBOM Report";

function detectLockfile(forced: string): string | null {
  if (forced) return fs.existsSync(forced) ? forced : null;
  for (const c of ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"]) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

async function upsertPrComment(token: string, body: string): Promise<void> {
  const { context } = github;
  if (context.eventName !== "pull_request" && context.eventName !== "pull_request_target") return;
  const issue_number = context.payload.pull_request?.number;
  if (!issue_number) return;
  const octokit = github.getOctokit(token);
  const { data: comments } = await octokit.rest.issues.listComments({ ...context.repo, issue_number });
  const existing = comments.find((c) => c.body?.includes(MARKER));
  if (existing) {
    await octokit.rest.issues.updateComment({ ...context.repo, comment_id: existing.id, body });
    return;
  }
  await octokit.rest.issues.createComment({ ...context.repo, issue_number, body });
}

async function run(): Promise<void> {
  const token = core.getInput("github-token") || process.env.GITHUB_TOKEN || "";
  const format = (core.getInput("format") || "cyclonedx").toLowerCase();
  if (format !== "cyclonedx") {
    core.setFailed(`Unsupported format: ${format}. Use cyclonedx.`);
    return;
  }
  const lockfile = detectLockfile(core.getInput("lockfile-path") || "");
  if (!lockfile) {
    core.setFailed("No lockfile found (package-lock.json, yarn.lock, pnpm-lock.yaml).");
    return;
  }
  const text = fs.readFileSync(lockfile, "utf8");
  const components =
    lockfile.endsWith("package-lock.json")
      ? componentsFromPackageLock(text)
      : lockfile.endsWith("yarn.lock")
        ? componentsFromYarnLock(text)
        : componentsFromPnpmLock(text);

  const outputPath = core.getInput("output-path") || "sbom.cdx.json";
  const doc = buildCycloneDx(components);
  const abs = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(doc, null, 2), "utf8");

  const summary = formatSbomSummary(components, outputPath, MARKER, NAME);
  await core.summary.addRaw(summary, true).write();
  if (token) {
    try {
      await upsertPrComment(token, summary);
    } catch (e) {
      core.warning(`Could not post PR comment: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  core.setOutput("component-count", String(components.length));
  core.setOutput("output-path", outputPath);
  core.info(`SBOM: ${components.length} components from ${lockfile} → ${outputPath}`);
}

run().catch((e) => core.setFailed(e instanceof Error ? e.message : String(e)));
