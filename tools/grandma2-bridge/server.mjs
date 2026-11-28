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
let loginSent = false;
let pending = [];
let lastError = "";

let telnetRemainder = Buffer.alloc(0);
function cleanTelnet(chunk) {
  // Responde à negociação Telnet em vez de simplesmente descartar os bytes IAC.
  const input = Buffer.concat([telnetRemainder, Buffer.from(chunk)]);
  const out = [];
  const replies = [];
  let i = 0;
  while (i < input.length) {
    if (input[i] !== 255) { out.push(input[i++]); continue; }
    if (i + 1 >= input.length) break;
    const cmd = input[i + 1];
    if (cmd === 255) { out.push(255); i += 2; continue; }
    if (cmd === 250) {
      let end = i + 2;
      while (end + 1 < input.length && !(input[end] === 255 && input[end + 1] === 240)) end++;
      if (end + 1 >= input.length) break;
      i = end + 2;
      continue;
    }
    if (cmd === 251 || cmd === 252 || cmd === 253 || cmd === 254) {
      if (i + 2 >= input.length) break;
      const option = input[i + 2];
      if (cmd === 251) replies.push(255, option === 1 || option === 3 ? 253 : 254, option);
      else if (cmd === 253) replies.push(255, option === 3 ? 251 : 252, option);
      i += 3;
      continue;
    }
    i += 2;
  }
  telnetRemainder = input.subarray(i);
  if (replies.length && socket && !socket.destroyed) socket.write(Buffer.from(replies));
  return Buffer.from(out).toString("utf8");
}
function closeSocket(reason = "Connection closed") {
  connected = false; loggedIn = false; loginSent = false; buffer = ""; telnetRemainder = Buffer.alloc(0);
  if (loginTimer) clearTimeout(loginTimer);
  loginTimer = null;
  if (connectWaiter) { connectWaiter.reject(new Error(reason)); connectWaiter = null; }
  if (socket) { const old = socket; socket = null; old.destroy(); }
  pending.splice(0).forEach(p => p.reject(new Error(reason)));
}
function onData(chunk) {
  // grandMA2 pode dividir uma resposta em vários pacotes. Mantemos o buffer
  // até receber o prompt completo e removemos códigos ANSI do terminal.
  const text = cleanTelnet(chunk).replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "");
  if (!text) return;
  buffer = (buffer + text).slice(-131072);
  const promptSeen = /\[(?:Channel|Group)\]>\s*$/i.test(buffer);

  if (!loggedIn) {
    if (/(login\s+incorrect|incorrect\s+login|wrong password|login failed|access denied)/i.test(buffer)) {
      lastError = "GrandMA2 recusou o usuário/senha. Confira as credenciais do usuário Telnet.";
      const waiter = connectWaiter;
      connectWaiter = null;
      if (waiter) waiter.reject(new Error(lastError));
      closeSocket(lastError);
      return;
    }

    // O console pode primeiro entrar como guest e só depois exibir o prompt.
    // Enviamos o login uma única vez por conexão.
    if (!loginSent && (/(please\s+login|username|user name)/i.test(buffer) || promptSeen)) {
      loginSent = true;
      socket?.write("Login " + config.username + (config.password ? " " + config.password : "") + "\r\n");
      buffer = "";
      return;
    }

    // O prompt de guest não comprova autenticação. Exigimos a identificação
    // explícita do usuário configurado antes de liberar comandos.
    const authMatch = buffer.match(/logged\s+in\s+as\s+user\s+['"]?([^'"\r\n]+)/i);
    if (authMatch && authMatch[1].trim().toLowerCase() === config.username.toLowerCase() && promptSeen) {
      loggedIn = true;
      connected = true;
      lastError = "";
      if (loginTimer) clearTimeout(loginTimer);
      loginTimer = null;
      buffer = "";
      const waiter = connectWaiter;
      connectWaiter = null;
      if (waiter) waiter.resolve();
    }
    return;
  }

  if (promptSeen && pending.length) {
    const p = pending.shift();
    const response = buffer.replace(/\[(?:Channel|Group)\]>\s*$/i, "").trim();
    buffer = "";
    lastError = "";
    p.resolve(response);
  }
}
function connect() {
  if (connected && loggedIn && socket) return Promise.resolve();
  return new Promise((resolve, reject) => {
    closeSocket("Reconnecting");
    if (!config.host) return reject(new Error("Configure o IP da GrandMA2 primeiro."));
    const s = net.createConnection({ host: config.host, port: config.port });
    socket = s;
    loginSent = false;
    loginTimer = setTimeout(() => {
      lastError = "Tempo esgotado aguardando autenticação Telnet. Confira IP, porta, usuário e senha.";
      const waiter = connectWaiter;
      connectWaiter = null;
      closeSocket(lastError);
      if (waiter) waiter.reject(new Error(lastError));
    }, 20000);
    connectWaiter = {
      resolve: () => { if (loginTimer) clearTimeout(loginTimer); loginTimer = null; connected = true; loggedIn = true; resolve(); },
      reject: error => { if (loginTimer) clearTimeout(loginTimer); loginTimer = null; reject(error); }
    };
    s.on("connect", () => { connected = true; });
    s.on("data", onData);
    s.on("error", e => {
      lastError = e.message;
      if (loginTimer) clearTimeout(loginTimer);
      loginTimer = null;
      const waiter = connectWaiter;
      connectWaiter = null;
      if (waiter) waiter.reject(e);
      closeSocket(e.message);
    });
    s.on("close", () => {
      connected = false;
      loggedIn = false;
      if (connectWaiter) {
        const waiter = connectWaiter;
        connectWaiter = null;
        waiter.reject(new Error("A conexão Telnet foi encerrada antes da autenticação."));
      }
    });
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
      reject(new Error("A GrandMA2 não devolveu o prompt após 30 segundos. O comando pode ter sido executado; confira o console antes de reenviar."));
    }, 30000);
    entry.resolve = value => { clearTimeout(timer); resolve(value); };
    entry.reject = error => { clearTimeout(timer); reject(error); };
    pending.push(entry);
    socket.write(command + "\r\n");
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
      if (!username) return json(res, 400, { error: "Informe o usuário Telnet." });
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
      const response = await send(command);
      lastError = "";
      return json(res, 200, { response });
    }
    if (url.pathname === "/disconnect") { closeSocket(); config.password = ""; return json(res, 200, { disconnected: true }); }
    return json(res, 404, { error: "Not found" });
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e);
    return json(res, 500, { error: lastError });
  }
});
server.listen(PORT, HOST, () => console.log(`Shalom GrandMA2 bridge listening on ${HOST}:${PORT}`));
