import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const source = await readFile(new URL("../src/automation/device-manager.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }
}).outputText;
const modulePath = path.join(tmpdir(), `shalom-device-manager-${process.pid}.mjs`);
await writeFile(modulePath, compiled);
const { normalizeDevice, probeDevice } = await import(pathToFileURL(modulePath).href);

const valid = (overrides = {}) => ({
  id: "vmix-1", name: "vMix", kind: "vmix", host: "192.168.1.20",
  port: 8088, healthPath: "/health", enabled: true, ...overrides
});

test("accepts private IPv4 addresses and normalizes optional fields", () => {
  for (const host of ["10.0.0.1", "172.16.0.1", "172.31.255.254", "192.168.1.2"]) {
    assert.equal(normalizeDevice(valid({ host })).host, host);
  }
  assert.equal(normalizeDevice(valid({ enabled: undefined })).enabled, true);
});

test("rejects public, malformed, and out-of-range IPv4 addresses", () => {
  for (const host of ["8.8.8.8", "172.32.0.1", "192.168.1.256", "localhost", "192.168.1"]) {
    assert.throws(() => normalizeDevice(valid({ host })), /IPv4 privado/);
  }
});

test("rejects invalid ports and unsafe health paths", () => {
  for (const port of [0, 65536, 1.5, "abc"]) {
    assert.throws(() => normalizeDevice(valid({ port })), /porta válida/);
  }
  for (const healthPath of ["health", "//evil.test/path", "/health\r\nX: y"]) {
    assert.throws(() => normalizeDevice(valid({ healthPath })), /caminho de saúde/);
  }
});

test("reports a successful health response as online", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "http://192.168.1.20:8088/health");
    assert.equal(options.method, "GET");
    return new Response("", { status: 200 });
  };
  try {
    const result = await probeDevice(valid());
    assert.equal(result.online, true);
    assert.equal(result.statusCode, 200);
    assert.equal(result.id, "vmix-1");
  } finally { globalThis.fetch = originalFetch; }
});

test("reports non-success HTTP responses as offline", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("", { status: 503 });
  try {
    const result = await probeDevice(valid());
    assert.equal(result.online, false);
    assert.equal(result.statusCode, 503);
    assert.equal(result.error, "HTTP 503");
  } finally { globalThis.fetch = originalFetch; }
});

test("converts connection failures into offline probe results", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("connection refused"); };
  try {
    const result = await probeDevice(valid());
    assert.equal(result.online, false);
    assert.equal(result.error, "connection refused");
  } finally { globalThis.fetch = originalFetch; }
});
