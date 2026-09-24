import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { resolveRequest } from "../src/run.mjs";

function workspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "aas-action-test-"));
}

test("skills mode accepts an exact ID list and stays a dry run", () => {
  const request = resolveRequest({
    GITHUB_WORKSPACE: workspace(),
    AAS_VERSION: "18.3.0",
    AAS_SKILLS: "concise-planning,verification-before-completion",
    AAS_TARGET: "codex",
    AAS_DRY_RUN: "true",
  });
  assert.equal(request.version, "18.3.0");
  assert.deepEqual(request.skills, ["concise-planning", "verification-before-completion"]);
  assert.equal(request.dryRun, true);
  assert.equal(request.manifestPath, "");
});

test("manifest mode uses the catalog version pinned in the file", () => {
  const root = workspace();
  fs.writeFileSync(path.join(root, "aas-stack.json"), JSON.stringify({
    catalog: { package: "agentic-awesome-skills", version: "18.3.0" },
    skills: [{ id: "concise-planning" }],
  }));
  const request = resolveRequest({
    GITHUB_WORKSPACE: root,
    AAS_VERSION: "",
    AAS_MANIFEST: "aas-stack.json",
    AAS_SKILLS: "",
    AAS_TARGET: "codex",
    AAS_DRY_RUN: "true",
  });
  assert.equal(request.version, "18.3.0");
  assert.deepEqual(request.skills, ["concise-planning"]);
  assert.equal(request.manifestPath, path.join(root, "aas-stack.json"));
});

test("rejects a manifest path outside the repository", () => {
  assert.throws(() => resolveRequest({
    GITHUB_WORKSPACE: workspace(),
    AAS_MANIFEST: "../aas-stack.json",
    AAS_SKILLS: "",
  }), /inside the repository/);
});

test("rejects a version that disagrees with the manifest", () => {
  const root = workspace();
  fs.writeFileSync(path.join(root, "aas-stack.json"), JSON.stringify({
    catalog: { package: "agentic-awesome-skills", version: "18.2.0" },
    skills: [{ id: "concise-planning" }],
  }));
  assert.throws(() => resolveRequest({
    GITHUB_WORKSPACE: root,
    AAS_VERSION: "18.3.0",
    AAS_MANIFEST: "aas-stack.json",
    AAS_SKILLS: "",
  }), /does not match/);
});

test("rejects both inputs and unknown skill IDs", () => {
  const root = workspace();
  assert.throws(() => resolveRequest({
    GITHUB_WORKSPACE: root,
    AAS_MANIFEST: "aas-stack.json",
    AAS_SKILLS: "concise-planning",
  }), /exactly one/);
  assert.throws(() => resolveRequest({
    GITHUB_WORKSPACE: root,
    AAS_SKILLS: "Not A Skill",
  }), /skill IDs/);
});
