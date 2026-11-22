import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";

const backupKey = process.env.D1_BACKUP_KEY;
const reportPath = process.env.DRILL_REPORT_PATH ?? "d1-restore-drill-report.json";
if (!backupKey || !backupKey.endsWith(".sql")) throw new Error("D1_BACKUP_KEY must identify an uploaded SQL backup.");
const stamp = new Date().toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 14);
const databaseName = `reviewradar-staging-restore-drill-${stamp}`;
const report = { workflowRunId: process.env.GITHUB_RUN_ID ?? null, startedAt: new Date().toISOString(), backupKey, temporaryDatabase: databaseName, expected: {}, actual: {}, result: "failed" };
const run = (args, options = {}) => execFileSync("npx", ["wrangler", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 20 * 1024 * 1024, ...options });
const parseWranglerJson = (output) => {
  const start = output.indexOf("[");
  const end = output.lastIndexOf("]");
  if (start < 0 || end < start) throw new Error("Could not parse Wrangler JSON output.");
  return JSON.parse(output.slice(start, end + 1));
};
const quoteIdentifier = (value) => `"${value.replaceAll('"', '""')}"`;

let created = false;
let failed = false;
try {
  report.expected = JSON.parse(await readFile(process.env.D1_BACKUP_COUNTS_PATH ?? "/tmp/reviewradar-production.counts.json", "utf8"));
  run(["d1", "create", databaseName, "--location", "eeur"]);
  created = true;
  run(["d1", "execute", databaseName, "--remote", "--yes", "--file", process.env.D1_BACKUP_SQL_PATH ?? "/tmp/reviewradar-production.sql"]);

  for (const table of Object.keys(report.expected).sort()) {
    const output = run(["d1", "execute", databaseName, "--remote", "--json", "--command", `SELECT COUNT(*) AS row_count FROM ${quoteIdentifier(table)}`]);
    const records = parseWranglerJson(output);
    const count = records.flatMap((record) => record.results ?? []).find((row) => row.row_count !== undefined)?.row_count;
    if (count === undefined) throw new Error(`No row count returned for table ${table}.`);
    report.actual[table] = Number(count);
  }

  const missingTables = Object.keys(report.expected).filter((table) => !(table in report.actual));
  const mismatches = Object.keys(report.expected).filter((table) => report.expected[table] !== report.actual[table]);
  report.result = missingTables.length || mismatches.length ? "failed" : "passed";
  report.missingTables = missingTables;
  report.mismatches = mismatches;
} catch (error) {
  failed = true;
  report.error = error instanceof Error ? error.message.slice(0, 500) : "Restore drill failed.";
} finally {
  if (created) {
    try { run(["d1", "delete", databaseName, "--skip-confirmation"]); }
    catch (error) { failed = true; report.result = "failed"; report.cleanupError = error instanceof Error ? error.message.slice(0, 500) : "Temporary database cleanup failed."; }
  }
  report.finishedAt = new Date().toISOString();
  report.durationSeconds = Math.round((Date.parse(report.finishedAt) - Date.parse(report.startedAt)) / 1000);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

if (report.result !== "passed" || failed) {
  process.stderr.write(`D1 restore drill ${report.result}. Report written to ${reportPath}.\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`D1 restore drill passed in ${report.durationSeconds}s across ${Object.keys(report.actual).length} tables.\n`);
}
