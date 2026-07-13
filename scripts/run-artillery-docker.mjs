import { mkdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const [, , testFile, ...flags] = process.argv;

if (!testFile) {
  console.error("Usage: node scripts/run-artillery-docker.mjs tests/load/read-only.yml [--report]");
  process.exit(1);
}

const repoRoot = process.cwd();
const loadDir = path.join(repoRoot, "tests", "load");
const resultsDir = path.join(repoRoot, "artillery-results");
const normalizedTestPath = path.normalize(testFile);
const testName = path.basename(normalizedTestPath);
const wantsReport = flags.includes("--report");

if (!normalizedTestPath.startsWith(path.join("tests", "load"))) {
  console.error("Artillery test files must live in tests/load.");
  process.exit(1);
}

mkdirSync(resultsDir, { recursive: true });

const image = process.env.ARTILLERY_DOCKER_IMAGE || "node:22-alpine";
const version = process.env.ARTILLERY_VERSION || "2.0.33";
const target = process.env.LOAD_TARGET || process.env.ARTILLERY_TARGET || "http://host.docker.internal:3000";
const useDockerNpmCache = process.env.ARTILLERY_USE_DOCKER_NPM_CACHE === "1";
const reportJson = `/results/${testName.replace(/\.ya?ml$/i, "")}.json`;
const reportHtml = `/results/${testName.replace(/\.ya?ml$/i, "")}.html`;

const runParts = [
  `npm --yes exec artillery@${version} -- run`,
  `--target "$LOAD_TARGET"`,
  wantsReport ? `-o ${reportJson}` : "",
  `/load/${testName}`,
].filter(Boolean);

const reportParts = wantsReport
  ? [`npm --yes exec artillery@${version} -- report ${reportJson} -o ${reportHtml}`]
  : [];

const command = [
  ...runParts,
  ...(reportParts.length ? ["&&", ...reportParts] : []),
].join(" ");

console.log(`Running ${testName} against ${target}`);
if (wantsReport) {
  console.log(`Report will be written to artillery-results/${path.basename(reportHtml)}`);
}

const result = spawnSync(
  "docker",
  [
    "run",
    "--rm",
    "-v",
    `${loadDir}:/load:ro`,
    "-v",
    `${resultsDir}:/results`,
    ...(useDockerNpmCache ? ["-v", "artillery-npm-cache:/root/.npm"] : []),
    "-e",
    `LOAD_TARGET=${target}`,
    "-e",
    "NO_UPDATE_NOTIFIER=1",
    "-e",
    "ARTILLERY_DISABLE_TELEMETRY=true",
    image,
    "sh",
    "-lc",
    command,
  ],
  { stdio: "inherit" },
);

process.exit(result.status ?? 1);
