import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const source = await readFile(new URL("../src/automation/engine.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }
}).outputText;
const modulePath = path.join(tmpdir(), `shalom-automation-engine-${process.pid}.mjs`);
await writeFile(modulePath, compiled);
const { runSequentialAutomation } = await import(pathToFileURL(modulePath).href);

const checkpoint = () => ({ status: "running", currentStep: null, stepResults: {} });
const makeSteps = (calls, failAt) => ["a", "b", "c"].map(id => ({
  id, label: id, execute: async () => {
    calls.push(id);
    if (id === failAt) throw new Error("simulated failure");
  }
}));

test("executes steps strictly in sequence and completes", async () => {
  const calls = [];
  const saved = [];
  const result = await runSequentialAutomation({
    steps: makeSteps(calls), checkpoint: checkpoint(),
    persist: async value => saved.push(structuredClone(value))
  });
  assert.deepEqual(calls, ["a", "b", "c"]);
  assert.equal(result.status, "completed");
  assert.equal(saved.at(-1).status, "completed");
});

test("pauses on failure and does not execute later steps", async () => {
  const calls = [];
  const result = await runSequentialAutomation({
    steps: makeSteps(calls, "b"), checkpoint: checkpoint(), persist: async () => {}
  });
  assert.deepEqual(calls, ["a", "b"]);
  assert.equal(result.status, "paused");
  assert.equal(result.stepResults.b.status, "failed");
});

test("resume skips successful steps and retries the failed step", async () => {
  const firstCalls = [];
  const first = await runSequentialAutomation({
    steps: makeSteps(firstCalls, "b"), checkpoint: checkpoint(), persist: async () => {}
  });
  const resumedCalls = [];
  const resumed = await runSequentialAutomation({
    steps: makeSteps(resumedCalls), checkpoint: first, persist: async () => {}
  });
  assert.deepEqual(resumedCalls, ["b", "c"]);
  assert.equal(resumed.status, "completed");
});
