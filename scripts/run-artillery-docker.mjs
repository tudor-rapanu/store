import { existsSync, mkdirSync } from "node:fs";
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
const resolvedTestPath = path.resolve(repoRoot, testFile);
const testName = path.basename(resolvedTestPath);
const wantsReport = flags.includes("--report");
const unknownFlags = flags.filter((flag) => flag !== "--report");

const FIXED_PATH = "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin";
const DOCKER_BINARY_CANDIDATES = [
  "/usr/local/bin/docker",
  "/opt/homebrew/bin/docker",
  "/usr/bin/docker",
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function resolveDockerBinary() {
  const dockerBinary = DOCKER_BINARY_CANDIDATES.find((candidate) =>
    existsSync(candidate),
  );

  if (!dockerBinary) {
    fail(
      "Docker binary was not found in a fixed trusted location. Expected one of: " +
        DOCKER_BINARY_CANDIDATES.join(", "),
    );
  }

  return dockerBinary;
}

function validateTarget(value) {
  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      fail("LOAD_TARGET must use http or https.");
    }

    return url.toString().replace(/\/$/, "");
  } catch {
    fail("LOAD_TARGET must be a valid URL.");
  }
}

function validateDockerImage(value) {
  if (!/^[a-z0-9][a-z0-9._/-]*(?::[a-z0-9._-]+)?$/i.test(value)) {
    fail("ARTILLERY_DOCKER_IMAGE contains invalid characters.");
  }

  return value;
}

function validatePackageVersion(value) {
  if (!/^\d+\.\d+\.\d+(?:[-+][a-z0-9.-]+)?$/i.test(value)) {
    fail("ARTILLERY_VERSION must be an exact npm package version.");
  }

  return value;
}

if (path.dirname(resolvedTestPath) !== loadDir) {
  console.error("Artillery test files must live in tests/load.");
  process.exit(1);
}

if (unknownFlags.length > 0) {
  console.error(`Unsupported Artillery runner flags: ${unknownFlags.join(", ")}`);
  process.exit(1);
}

if (!/^[a-z0-9._-]+\.ya?ml$/i.test(testName)) {
  console.error("Artillery test file names may only contain letters, numbers, dots, underscores, and hyphens.");
  process.exit(1);
}

if (!existsSync(resolvedTestPath)) {
  console.error(`Artillery test file does not exist: ${testFile}`);
  process.exit(1);
}

mkdirSync(resultsDir, { recursive: true });

const dockerBinary = resolveDockerBinary();
const image = validateDockerImage(
  process.env.ARTILLERY_DOCKER_IMAGE || "node:22-alpine",
);
const version = validatePackageVersion(process.env.ARTILLERY_VERSION || "2.0.33");
const target = validateTarget(
  process.env.LOAD_TARGET ||
    process.env.ARTILLERY_TARGET ||
    "http://host.docker.internal:3000",
);
const useDockerNpmCache = process.env.ARTILLERY_USE_DOCKER_NPM_CACHE === "1";
const reportJson = `/results/${testName.replace(/\.ya?ml$/i, "")}.json`;
const reportHtml = `/results/${testName.replace(/\.ya?ml$/i, "")}.html`;

console.log(`Running ${testName} against ${target}`);
if (wantsReport) {
  console.log(`Report will be written to artillery-results/${path.basename(reportHtml)}`);
}

const dockerBaseArgs = [
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
];

const childEnv = {
  PATH: FIXED_PATH,
  ...(process.env.HOME ? { HOME: process.env.HOME } : {}),
  ...(process.env.DOCKER_CONFIG
    ? { DOCKER_CONFIG: process.env.DOCKER_CONFIG }
    : {}),
  ...(process.env.DOCKER_CONTEXT
    ? { DOCKER_CONTEXT: process.env.DOCKER_CONTEXT }
    : {}),
  ...(process.env.DOCKER_HOST ? { DOCKER_HOST: process.env.DOCKER_HOST } : {}),
};

function runDocker(commandArgs) {
  return spawnSync(dockerBinary, [...dockerBaseArgs, ...commandArgs], {
    env: childEnv,
    stdio: "inherit",
  });
}

const runResult = runDocker([
  "npm",
  "--yes",
  "exec",
  `artillery@${version}`,
  "--",
  "run",
  "--target",
  target,
  ...(wantsReport ? ["-o", reportJson] : []),
  `/load/${testName}`,
]);

if (runResult.status !== 0) {
  process.exit(runResult.status ?? 1);
}

if (!wantsReport) {
  process.exit(0);
}

const reportResult = runDocker([
  "npm",
  "--yes",
  "exec",
  `artillery@${version}`,
  "--",
  "report",
  reportJson,
  "-o",
  reportHtml,
]);

process.exit(reportResult.status ?? 1);
