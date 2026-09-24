import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const DEFAULT_VERSION = "18.3.0";
export const PACKAGE_NAME = "agentic-awesome-skills";
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const SKILL_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*$/;
const TARGETS = new Set(["cursor", "claude", "gemini", "codex", "kiro", "antigravity", "agy"]);

export function fail(message) {
  const error = new Error(message);
  error.code = "AAS_ACTION_INPUT_INVALID";
  throw error;
}

export function parseVersion(value) {
  const version = value === undefined || value === "" ? DEFAULT_VERSION : String(value).trim();
  if (!VERSION_PATTERN.test(version)) fail(`version must be an exact semver, received ${JSON.stringify(value)}`);
  return version;
}

export function parseBoolean(value, name) {
  const normalized = String(value ?? "true").trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  fail(`${name} must be true or false`);
  return false;
}

export function parseTarget(value) {
  const target = String(value ?? "codex").trim();
  if (!TARGETS.has(target)) fail(`target must be one of ${[...TARGETS].join(", ")}`);
  return target;
}

export function parseSkillList(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  const skills = raw.split(",").map((entry) => entry.trim());
  if (skills.some((entry) => !SKILL_ID_PATTERN.test(entry))) {
    fail("skills must be a comma-separated list of AAS skill IDs");
  }
  if (new Set(skills).size !== skills.length) fail("skills contains a duplicate ID");
  return skills;
}

export function resolveManifestPath(workspace, input) {
  const raw = String(input ?? "").trim();
  if (!raw) return "";
  if (raw.includes("\0") || path.isAbsolute(raw)) fail("manifest must be a relative path inside the repository");
  const workspaceRoot = path.resolve(workspace);
  const resolved = path.resolve(workspaceRoot, raw);
  const relative = path.relative(workspaceRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    fail("manifest must stay inside the repository");
  }
  return resolved;
}

export function readManifestSkills(manifestPath) {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch {
    fail(`manifest is not readable JSON: ${path.basename(manifestPath)}`);
  }
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) fail("manifest must be a JSON object");
  if (manifest.catalog?.package !== PACKAGE_NAME) {
    fail(`manifest catalog.package must be ${PACKAGE_NAME}`);
  }
  if (!Array.isArray(manifest.skills)) fail("manifest skills must be an array");
  const skills = manifest.skills.map((skill) => skill?.id);
  if (skills.some((id) => typeof id !== "string" || !SKILL_ID_PATTERN.test(id))) {
    fail("manifest contains an invalid skill ID");
  }
  if (new Set(skills).size !== skills.length) fail("manifest contains a duplicate skill ID");
  return { version: manifest.catalog?.version, skills };
}

export function resolveRequest(env) {
  const workspace = env.GITHUB_WORKSPACE || process.cwd();
  const version = parseVersion(env.AAS_VERSION);
  const manifestPath = resolveManifestPath(workspace, env.AAS_MANIFEST);
  const directSkills = parseSkillList(env.AAS_SKILLS);
  const dryRun = parseBoolean(env.AAS_DRY_RUN, "dry-run");
  const target = parseTarget(env.AAS_TARGET);
  if (Boolean(manifestPath) === Boolean(directSkills.length)) {
    fail("supply exactly one of manifest or skills");
  }
  let skills = directSkills;
  let manifestVersion = "";
  if (manifestPath) {
    const manifest = readManifestSkills(manifestPath);
    manifestVersion = String(manifest.version ?? "");
    if (!VERSION_PATTERN.test(manifestVersion)) fail("manifest catalog.version must be an exact semver");
    if (env.AAS_VERSION && env.AAS_VERSION.trim() && env.AAS_VERSION.trim() !== manifestVersion) {
      fail(`version ${version} does not match manifest catalog.version ${manifestVersion}`);
    }
    skills = manifest.skills;
  }
  const resolvedVersion = manifestPath ? manifestVersion : version;
  return { workspace, version: resolvedVersion, manifestPath, skills, dryRun, target };
}

function npmArgs(version, commandArgs) {
  return [
    "exec",
    "--yes",
    "--ignore-scripts",
    `--package=${PACKAGE_NAME}@${version}`,
    "--",
    PACKAGE_NAME,
    ...commandArgs,
  ];
}

function readLastJson(text) {
  const lines = String(text).trim().split(/\r?\n/).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(lines[index]);
    } catch {
      // npm may print a prelude before the AAS result envelope.
    }
  }
  return null;
}

export function run(env = process.env, execFile = execFileSync) {
  const request = resolveRequest(env);
  let manifestDigest = "";
  if (request.manifestPath) {
    const stdout = execFile("npm", npmArgs(request.version, [
      "stack",
      "validate",
      "--manifest",
      request.manifestPath,
    ]), {
      cwd: request.workspace,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
      timeout: 10 * 60 * 1000,
    });
    const result = readLastJson(stdout);
    if (!result?.ok || result.status !== "valid" || typeof result.manifestDigest !== "string") {
      fail("aas stack validate did not return a valid manifest");
    }
    manifestDigest = result.manifestDigest;
    process.stdout.write(stdout.endsWith("\n") ? stdout : `${stdout}\n`);
  }
  if (request.skills.length) {
    const previewRoot = fs.mkdtempSync(path.join(env.RUNNER_TEMP || env.TMPDIR || "/tmp", "aas-action-"));
    const installArgs = ["--release", request.version, "--skills", request.skills.join(",")];
    if (request.dryRun) installArgs.push("--path", previewRoot, "--dry-run");
    else installArgs.push(`--${request.target}`);
    execFile("npm", npmArgs(request.version, installArgs), {
      cwd: request.workspace,
      stdio: "inherit",
      timeout: 10 * 60 * 1000,
    });
  }
  writeOutput(env, {
    version: request.version,
    "skill-count": String(request.skills.length),
    "manifest-digest": manifestDigest,
  });
  const summaryPath = env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    const mode = request.manifestPath ? "manifest" : "skills";
    fs.appendFileSync(summaryPath, [
      "### Agentic Awesome Skills",
      "",
      `- Mode: \`${mode}\``,
      `- Version: \`${request.version}\``,
      `- Skills checked: ${request.skills.length}`,
      `- Dry run: ${request.dryRun}`,
      manifestDigest ? `- Manifest digest: \`${manifestDigest}\`` : "",
      "",
    ].filter(Boolean).join("\n"));
  }
  return { ...request, manifestDigest };
}

function writeOutput(env, values) {
  if (!env.GITHUB_OUTPUT) return;
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`);
  fs.appendFileSync(env.GITHUB_OUTPUT, `${lines.join("\n")}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    run();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
