import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const [, , profileName, ...flags] = process.argv;

if (!profileName) {
  console.error("Usage: node scripts/run-artillery-docker.mjs <profile> [--report]");
  process.exit(1);
}

const repoRoot = process.cwd();
const loadDir = path.join(repoRoot, "tests", "load");
const resultsDir = path.join(repoRoot, "artillery-results");
const wantsReport = flags.includes("--report");
const unknownFlags = flags.filter((flag) => flag !== "--report");

const FIXED_PATH = "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin";
const ARTILLERY_DOCKER_IMAGE = "node:22-alpine";
const ARTILLERY_VERSION = "2.0.33";
const LOAD_TEST_PROFILES = {
  smoke: "read-only.yml",
  baseline: "baseline.yml",
  flow: "storefront-flow.yml",
  spike: "spike.yml",
  stress: "stress.yml",
  "stress-catalog": "stress-catalog.yml",
  "stress-api": "stress-api.yml",
  "stress-mixed": "stress-mixed-realistic.yml",
};
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

function resolveProfile(name) {
  if (!/^[a-z0-9-]+$/i.test(name)) {
    fail("Load-test profile contains invalid characters.");
  }

  const testName = LOAD_TEST_PROFILES[name];

  if (!testName) {
    fail(
      `Unknown load-test profile "${name}". Allowed profiles: ${Object.keys(
        LOAD_TEST_PROFILES,
      ).join(", ")}`,
    );
  }

  const resolvedTestPath = path.join(loadDir, testName);

  if (!existsSync(resolvedTestPath)) {
    fail(`Artillery test file does not exist: ${resolvedTestPath}`);
  }

  return testName;
}

if (unknownFlags.length > 0) {
  fail(`Unsupported Artillery runner flags: ${unknownFlags.join(", ")}`);
}

const testName = resolveProfile(profileName);

mkdirSync(resultsDir, { recursive: true });

const dockerBinary = resolveDockerBinary();
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
  console.log(
    `Report will be written to artillery-results/${path.basename(reportHtml)}`,
  );
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
  ARTILLERY_DOCKER_IMAGE,
];

const childEnv = {
  PATH: FIXED_PATH,
  ...(process.env.HOME ? { HOME: process.env.HOME } : {}),
  ...(process.env.DOCKER_CONFIG ? { DOCKER_CONFIG: process.env.DOCKER_CONFIG } : {}),
  ...(process.env.DOCKER_CONTEXT ? { DOCKER_CONTEXT: process.env.DOCKER_CONTEXT } : {}),
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
  `artillery@${ARTILLERY_VERSION}`,
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
  `artillery@${ARTILLERY_VERSION}`,
  "--",
  "report",
  reportJson,
  "-o",
  reportHtml,
]);

process.exit(reportResult.status ?? 1);
