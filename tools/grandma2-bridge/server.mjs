/**
 * Shalom GrandMA2 local bridge.
 * HTTP is loopback-only; Telnet credentials stay in process memory.
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
let loginTimer = null;
let connectWaiter = null;
let pending = [];
let lastError = "";

function cleanTelnet(chunk) {
  // Remove Telnet IAC negotiation triplets and command bytes from the data stream.
  const input = Buffer.from(chunk);
  const out = [];
  for (let i = 0; i < input.length; i++) {
    if (input[i] === 255) {
      const cmd = input[i + 1];
      if (cmd === 255) { out.push(255); i++; continue; }
      if (cmd === 250) { // sub-negotiation: skip through IAC SE
        i += 2;
        while (i < input.length && !(input[i] === 255 && input[i + 1] === 240)) i++;
        i++;
      } else if (cmd === 251 || cmd === 252 || cmd === 253 || cmd === 254) {
        i += 2;
      } else i++;
      continue;
    }
    out.push(input[i]);
  }
  return Buffer.from(out).toString("utf8");
}
function closeSocket(reason = "Connection closed") {
  connected = false; loggedIn = false; buffer = "";
  if (loginTimer) clearTimeout(loginTimer);
  loginTimer = null;
  if (connectWaiter) { connectWaiter.reject(new Error(reason)); connectWaiter = null; }
  if (socket) { const old = socket; socket = null; old.destroy(); }
  pending.splice(0).forEach(p => p.reject(new Error(reason)));
}
function onData(chunk) {
  const text = cleanTelnet(chunk);
  if (!text) return;
  buffer = (buffer + text).slice(-65536);
  const lower = buffer.toLowerCase();
  if (!loggedIn && (/(please\s+login|login|username|user name)/i.test(buffer))) {
    socket?.write(`Login ${config.username} ${config.password}\n`);
    buffer = "";
    return;
  }
  if (/\[Channel\]>\s*$/i.test(buffer)) {
    loggedIn = true;
    if (loginTimer) clearTimeout(loginTimer);
    loginTimer = null;
    if (connectWaiter) { connectWaiter.resolve(); connectWaiter = null; buffer = ""; return; }
    if (pending.length) {
      const p = pending.shift();
      const response = buffer.replace(/\[Channel\]>\s*$/i, "").trim();
      buffer = "";
      p.resolve(response);
    }
  } else if (!loggedIn && /(wrong password|login failed|access denied)/i.test(lower)) {
    lastError = "GrandMA2 recusou o usuário/senha.";
    if (connectWaiter) { connectWaiter.reject(new Error(lastError)); connectWaiter = null; }
    closeSocket(lastError);
  }
}
function connect() {
  if (connected && loggedIn && socket) return Promise.resolve();
  return new Promise((resolve, reject) => {
    closeSocket("Reconnecting");
    if (!config.host || !config.password) return reject(new Error("Configure IP e senha primeiro."));
    const s = net.createConnection({ host: config.host, port: config.port });
    socket = s;
    loginTimer = setTimeout(() => { lastError = "Tempo esgotado aguardando autenticação Telnet."; closeSocket(lastError); reject(new Error(lastError)); }, 12000);
    connectWaiter = {
      resolve: () => { if (loginTimer) clearTimeout(loginTimer); loginTimer = null; connected = true; loggedIn = true; resolve(); },
      reject: error => { if (loginTimer) clearTimeout(loginTimer); loginTimer = null; reject(error); }
    };
    s.on("connect", () => { connected = true; });
    s.on("data", onData);
    s.on("error", e => { lastError = e.message; if (loginTimer) clearTimeout(loginTimer); loginTimer = null; closeSocket(e.message); reject(e); });
    s.on("close", () => { connected = false; loggedIn = false; });
  });
}
function send(command) {
  if (!connected || !loggedIn || !socket) throw new Error("Conecte e autentique na GrandMA2 primeiro.");
  if (/[\r\n]/.test(command)) throw new Error("Envie apenas um comando por vez.");
  return new Promise((resolve, reject) => {
    const entry = { resolve, reject };
    const timer = setTimeout(() => {
      const i = pending.indexOf(entry);
      if (i >= 0) pending.splice(i, 1);
      reject(new Error("A GrandMA2 não retornou o prompt em 8 segundos."));
    }, 8000);
    entry.resolve = value => { clearTimeout(timer); resolve(value); };
    entry.reject = error => { clearTimeout(timer); reject(error); };
    pending.push(entry);
    socket.write(command + "\n");
  });
}
function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*", "access-control-allow-headers": "content-type", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-private-network": "true", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}
const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return json(res, 204, {});
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress)) return json(res, 403, { error: "Acesso permitido somente neste computador." });
  try {
    const url = new URL(req.url, `http://${HOST}:${PORT}`);
    if (req.method === "GET" && url.pathname === "/status") return json(res, 200, { connected, loggedIn, host: config.host, port: config.port, error: lastError });
    if (req.method !== "POST") return json(res, 404, { error: "Not found" });
    let body = "";
    for await (const chunk of req) { body += chunk; if (body.length > 8192) throw new Error("Request too large"); }
    const data = body ? JSON.parse(body) : {};
    if (url.pathname === "/configure") {
      const host = String(data.host || "").trim();
      if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)) return json(res, 400, { error: "Informe um endereço IPv4 válido." });
      const port = Number(data.port || 30000);
      if (!Number.isInteger(port) || port < 1 || port > 65535) return json(res, 400, { error: "Porta inválida." });
      const username = String(data.username || "administrator").trim();
      const password = String(data.password || "");
      if (!username || !password) return json(res, 400, { error: "Usuário e senha são obrigatórios." });
      closeSocket("Configuration changed");
      config = { host, port, username, password };
      lastError = "";
      return json(res, 200, { configured: true });
    }
    if (url.pathname === "/connect") { await connect(); return json(res, 200, { connected, loggedIn }); }
    if (url.pathname === "/command") {
      const command = String(data.command || "").trim();
      if (!command) return json(res, 400, { error: "Comando obrigatório." });
      if (command.length > 240) return json(res, 400, { error: "Comando muito longo." });
      if (!connected || !loggedIn) await connect();
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
