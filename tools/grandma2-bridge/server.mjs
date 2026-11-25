/**
 * Shalom GrandMA2 local bridge (Windows/macOS/Linux)
 * Local-only HTTP API; credentials stay in memory and are never logged.
 */
import http from "node:http";
import net from "node:net";

const HOST = "127.0.0.1";
const PORT = Number(process.env.SHALOM_BRIDGE_PORT || 17842);
let config = { host: "", port: 30000, username: "administrator", password: "" };
let socket = null;
let buffer = "";
let connected = false;
let loggedIn = false;
let pending = [];
let lastError = "";

function closeSocket() {
  connected = false; loggedIn = false; buffer = "";
  if (socket) { socket.destroy(); socket = null; }
  pending.splice(0).forEach(p => p.reject(new Error("Connection closed")));
}
function connect() {
  return new Promise((resolve, reject) => {
    closeSocket();
    if (!config.host || !config.password) return reject(new Error("Configure host and password first."));
    const s = net.createConnection({ host: config.host, port: config.port });
    socket = s;
    const timeout = setTimeout(() => { s.destroy(); reject(new Error("Telnet connection timed out")); }, 8000);
    s.on("connect", () => { clearTimeout(timeout); connected = true; resolve(); });
    s.on("data", chunk => {
      buffer += chunk.toString("utf8");
      if (buffer.length > 65536) buffer = buffer.slice(-32768);
      const lower = buffer.toLowerCase();
      if (!loggedIn && (lower.includes("login") || lower.includes("username"))) {
        s.write(`Login ${config.username} ${config.password}\n`);
        loggedIn = true;
      }
      const prompt = /\[Channel\]>/i.test(buffer);
      if (prompt && pending.length) {
        const p = pending.shift();
        const response = buffer; buffer = "";
        p.resolve(response);
      }
    });
    s.on("error", e => { lastError = e.message; clearTimeout(timeout); closeSocket(); reject(e); });
    s.on("close", () => { connected = false; loggedIn = false; });
  });
}
function send(command) {
  if (!connected || !socket) throw new Error("Not connected");
  if (/[\r\n]/.test(command)) throw new Error("One command per request");
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const i = pending.findIndex(p => p.resolve === resolve);
      if (i >= 0) pending.splice(i, 1);
      reject(new Error("Command response timed out"));
    }, 7000);
    pending.push({ resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
    socket.write(command + "\n");
  });
}
function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*", "access-control-allow-headers": "content-type", "access-control-allow-methods": "GET,POST,OPTIONS", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}
const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return json(res, 204, {});
  if (req.socket.remoteAddress !== "127.0.0.1" && req.socket.remoteAddress !== "::1" && req.socket.remoteAddress !== "::ffff:127.0.0.1") return json(res, 403, { error: "Local access only" });
  try {
    const url = new URL(req.url, `http://${HOST}:${PORT}`);
    if (req.method === "GET" && url.pathname === "/status") return json(res, 200, { connected, loggedIn, host: config.host, port: config.port, error: lastError });
    if (req.method !== "POST") return json(res, 404, { error: "Not found" });
    let body = "";
    for await (const chunk of req) body += chunk;
    const data = body ? JSON.parse(body) : {};
    if (url.pathname === "/configure") {
      const host = String(data.host || "").trim();
      if (!/^(?:\\d{1,3}\\.){3}\\d{1,3}$/.test(host)) return json(res, 400, { error: "Enter a valid IPv4 address" });
      const port = Number(data.port || 30000);
      if (!Number.isInteger(port) || port < 1 || port > 65535) return json(res, 400, { error: "Invalid port" });
      config = { host, port, username: String(data.username || "administrator"), password: String(data.password || "") };
      closeSocket();
      return json(res, 200, { configured: true });
    }
    if (url.pathname === "/connect") {
      await connect();
      return json(res, 200, { connected, loggedIn });
    }
    if (url.pathname === "/command") {
      const command = String(data.command || "").trim();
      if (!command) return json(res, 400, { error: "Command required" });
      if (!connected) await connect();
      return json(res, 200, { response: await send(command) });
    }
    if (url.pathname === "/disconnect") { closeSocket(); config.password = ""; return json(res, 200, { disconnected: true }); }
    return json(res, 404, { error: "Not found" });
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e);
    return json(res, 500, { error: lastError });
  }
});
server.listen(PORT, HOST, () => console.log(`Shalom GrandMA2 bridge listening on ${HOST}:${PORT}`));
