import net from "node:net";
import tls from "node:tls";
import { db, id } from "./db.mjs";

const SMTP_LAST_TEST_KEY = "smtp_last_test";

export function mailSettings() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'smtp'").get();
  const saved = row ? JSON.parse(row.value) : {};
  const port = Number(saved.port || process.env.SMTP_PORT || 587);
  const normalizedPort = Number.isFinite(port) && port > 0 ? port : 587;
  const secureFlag = saved.secure === true || process.env.SMTP_SECURE === "true" || normalizedPort === 465;
  return {
    host: String(saved.host || process.env.SMTP_HOST || "").trim(),
    port: normalizedPort,
    secure: smtpSecureForPort(normalizedPort, secureFlag),
    user: String(saved.user || process.env.SMTP_USER || ""),
    password: String(saved.password || process.env.SMTP_PASSWORD || ""),
    fromEmail: String(saved.fromEmail || process.env.SMTP_FROM || "").trim(),
    fromName: String(saved.fromName || "JobPilot").trim() || "JobPilot",
  };
}

function readSmtpLastTest() {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(SMTP_LAST_TEST_KEY);
  if (!row?.value) return null;
  try {
    const parsed = JSON.parse(row.value);
    const at = Number(parsed.at || 0);
    if (!at) return null;
    return {
      at,
      to: String(parsed.to || ""),
      host: String(parsed.host || ""),
      fromEmail: String(parsed.fromEmail || ""),
      port: Number(parsed.port || 0) || null,
    };
  } catch {
    return null;
  }
}

function clearSmtpLastTest() {
  db.prepare("DELETE FROM settings WHERE key = ?").run(SMTP_LAST_TEST_KEY);
}

/** Fingerprint of the SMTP path that was proven by Admin → Email → Send a test. */
export function smtpDeliveryFingerprint(settings = mailSettings()) {
  return {
    host: String(settings.host || "").trim().toLowerCase(),
    fromEmail: String(settings.fromEmail || "").trim().toLowerCase(),
    port: Number(settings.port) || 0,
    user: String(settings.user || "").trim(),
    secure: Boolean(settings.secure),
  };
}

export function smtpDeliveryStatus(settings = mailSettings()) {
  const configured = Boolean(settings.host && settings.fromEmail);
  const last = readSmtpLastTest();
  if (!configured || !last) {
    return {
      configured,
      deliveryProven: false,
      lastTestAt: last?.at || null,
      lastTestTo: last?.to || null,
      detail: configured
        ? "SMTP host and from address are saved. Send a test from Admin → Email before launch."
        : "SMTP host + from address missing. Password resets and notices will stay queued.",
    };
  }
  const now = smtpDeliveryFingerprint(settings);
  const matches =
    last.host === now.host &&
    last.fromEmail === now.fromEmail &&
    Number(last.port || 0) === now.port;
  return {
    configured,
    deliveryProven: matches,
    lastTestAt: last.at,
    lastTestTo: last.to || null,
    detail: matches
      ? `Test email delivered to ${last.to || "admin"} via ${settings.host} at ${new Date(last.at).toISOString()}.`
      : "SMTP settings changed since the last successful test. Send a test again from Admin → Email.",
  };
}

export function recordSmtpTestSuccess({ to, settings = mailSettings(), at = Date.now() } = {}) {
  const finger = smtpDeliveryFingerprint(settings);
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(
    SMTP_LAST_TEST_KEY,
    JSON.stringify({
      at,
      to: String(to || ""),
      host: finger.host,
      fromEmail: finger.fromEmail,
      port: finger.port,
      user: finger.user,
      secure: finger.secure,
    }),
  );
  return smtpDeliveryStatus(settings);
}

export function publicMailSettings() {
  const settings = mailSettings();
  const delivery = smtpDeliveryStatus(settings);
  return {
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    user: settings.user,
    fromEmail: settings.fromEmail,
    fromName: settings.fromName,
    hasPassword: Boolean(settings.password),
    configured: delivery.configured,
    deliveryProven: delivery.deliveryProven,
    lastTestAt: delivery.lastTestAt,
    lastTestTo: delivery.lastTestTo,
  };
}

/** Port 465 is implicit TLS; 587/25 use plain connect then STARTTLS when offered. */
export function smtpSecureForPort(port, secureFlag) {
  const normalized = Number(port) || 0;
  if (normalized === 465) return true;
  if (normalized === 587 || normalized === 25) return false;
  return Boolean(secureFlag);
}

export function saveMailSettings(input) {
  const current = mailSettings();
  const before = smtpDeliveryFingerprint(current);
  const port = Number(input.port);
  const nextPort = Number.isFinite(port) && port > 0 ? port : current.port;
  const next = {
    host: String(input.host ?? current.host).trim(),
    port: nextPort,
    secure: smtpSecureForPort(nextPort, input.secure ?? current.secure),
    user: String(input.user ?? current.user),
    password: input.password && !String(input.password).startsWith("••••") ? String(input.password) : current.password,
    fromEmail: String(input.fromEmail ?? current.fromEmail).trim(),
    fromName: String(input.fromName ?? current.fromName).trim() || "JobPilot",
  };
  db.prepare("INSERT INTO settings (key, value) VALUES ('smtp', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(JSON.stringify(next));
  const after = smtpDeliveryFingerprint(next);
  const passwordChanged = Boolean(input.password && !String(input.password).startsWith("••••"));
  if (
    passwordChanged ||
    before.host !== after.host ||
    before.fromEmail !== after.fromEmail ||
    before.port !== after.port ||
    before.user !== after.user ||
    before.secure !== after.secure
  ) {
    clearSmtpLastTest();
  }
  return publicMailSettings();
}

export async function deliverMail({ to, subject, body }) {
  const mailId = id("mail");
  db.prepare("INSERT INTO mail_outbox (id, to_email, subject, body, created_at, status, error) VALUES (?, ?, ?, ?, ?, 'stored', '')").run(
    mailId,
    to,
    subject,
    body,
    Date.now(),
  );
  const settings = mailSettings();
  if (!settings.host || !settings.fromEmail) {
    const error = "Email delivery is not configured.";
    db.prepare("UPDATE mail_outbox SET status = 'stored', error = ? WHERE id = ?").run(error, mailId);
    return { sent: false, id: mailId, error };
  }
  try {
    await sendSmtp({ ...settings, to, subject, body });
    db.prepare("UPDATE mail_outbox SET status = 'sent', error = '' WHERE id = ?").run(mailId);
    return { sent: true, id: mailId, error: "" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email could not be sent.";
    db.prepare("UPDATE mail_outbox SET status = 'failed', error = ? WHERE id = ?").run(message.slice(0, 500), mailId);
    return { sent: false, id: mailId, error: message };
  }
}

function takeReply(buffer) {
  const parts = buffer.split(/\r?\n/);
  const partial = buffer.endsWith("\n") ? "" : (parts.pop() ?? "");
  for (let index = 0; index < parts.length; index += 1) {
    if (/^\d{3} /.test(parts[index])) {
      const text = parts.slice(0, index + 1).join("\n");
      const rest = [...parts.slice(index + 1), partial].filter((line) => line !== "").join("\n");
      return { text, rest };
    }
  }
  return null;
}

function attachReader(socket) {
  let buffer = "";
  let waiter = null;
  let fail = null;
  socket.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    if (!waiter) return;
    const reply = takeReply(buffer);
    if (!reply) return;
    buffer = reply.rest;
    const resolve = waiter;
    waiter = null;
    fail = null;
    resolve(reply.text);
  });
  socket.on("error", (error) => {
    if (!fail) return;
    const reject = fail;
    waiter = null;
    fail = null;
    reject(error);
  });
  return {
    read() {
      const ready = takeReply(buffer);
      if (ready) {
        buffer = ready.rest;
        return Promise.resolve(ready.text);
      }
      return new Promise((resolve, reject) => {
        waiter = resolve;
        fail = reject;
      });
    },
  };
}

async function expectOk(socket, reader, line, { timeoutMs = 15000 } = {}) {
  if (line != null) socket.write(`${line}\r\n`);
  let timer;
  try {
    const text = await Promise.race([
      reader.read(),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error("The mail server stopped responding during the SMTP handshake."));
        }, timeoutMs);
      }),
    ]);
    const code = Number(String(text).slice(0, 3));
    if (code >= 400) throw new Error(String(text).trim().slice(0, 300));
    return { code, text };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function smtpEndpointLabel(settings) {
  const mode = settings.secure ? "implicit TLS" : "STARTTLS / plain";
  return `${settings.host}:${settings.port} (${mode})`;
}

export function formatSmtpConnectError(settings, cause) {
  const where = smtpEndpointLabel(settings);
  const code = cause && typeof cause === "object" ? String(cause.code || "") : "";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return `Could not resolve SMTP host ${settings.host}. Check the hostname.`;
  }
  if (code === "ECONNREFUSED") {
    return `SMTP refused the connection at ${where}. Wrong port, or the provider is not listening there.`;
  }
  if (code === "ECONNRESET") {
    return `SMTP reset the connection at ${where}. Try the other TLS mode (port 587 unchecked, or 465 with TLS).`;
  }
  if (code === "ETIMEDOUT" || code === "ESOCKETTIMEDOUT") {
    return (
      `Timed out connecting to ${where}. ` +
      "Confirm port 587 without “implicit TLS”, or 465 with it checked; many VPS firewalls also block outbound SMTP."
    );
  }
  const detail = cause instanceof Error && cause.message ? cause.message : "The mail server did not respond.";
  if (/did not respond/i.test(detail)) {
    return (
      `The mail server did not respond at ${where}. ` +
      "Port 587 must leave “implicit TLS” unchecked (STARTTLS). Port 465 must check it. " +
      "If settings look right, the host may block outbound SMTP — allow 587/465 or use your provider’s relay."
    );
  }
  return `Could not reach SMTP at ${where}: ${detail}`;
}

function openSocket(settings) {
  return new Promise((resolve, reject) => {
    const socket = settings.secure
      ? tls.connect({ host: settings.host, port: settings.port, servername: settings.host, timeout: 15000 })
      : net.connect({ host: settings.host, port: settings.port });
    if (typeof socket.setTimeout === "function") socket.setTimeout(15000);
    const reader = attachReader(socket);
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(formatSmtpConnectError(settings, { code: "ETIMEDOUT" })));
    }, 15000);
    const fail = (error) => {
      clearTimeout(timer);
      reject(new Error(formatSmtpConnectError(settings, error)));
    };
    socket.once("timeout", () => {
      socket.destroy();
      fail({ code: "ETIMEDOUT" });
    });
    socket.once("error", fail);
    socket.once(settings.secure ? "secureConnect" : "connect", () => {
      clearTimeout(timer);
      if (typeof socket.setTimeout === "function") socket.setTimeout(0);
      resolve({ socket, reader });
    });
  });
}

function upgradeTls(socket, host) {
  return new Promise((resolve, reject) => {
    const secure = tls.connect({ socket, servername: host });
    secure.once("error", reject);
    secure.once("secureConnect", () => resolve(secure));
  });
}

export async function sendSmtp(settings) {
  let { socket, reader } = await openSocket(settings);
  try {
    await expectOk(socket, reader, null);
    let hello = await expectOk(socket, reader, "EHLO jobpilot");
    if (!settings.secure && /STARTTLS/i.test(hello.text)) {
      await expectOk(socket, reader, "STARTTLS");
      socket.removeAllListeners("data");
      socket = await upgradeTls(socket, settings.host);
      reader = attachReader(socket);
      hello = await expectOk(socket, reader, "EHLO jobpilot");
    }
    if (settings.user) {
      await expectOk(socket, reader, "AUTH LOGIN");
      await expectOk(socket, reader, Buffer.from(settings.user).toString("base64"));
      await expectOk(socket, reader, Buffer.from(settings.password).toString("base64"));
    }
    await expectOk(socket, reader, `MAIL FROM:<${settings.fromEmail}>`);
    await expectOk(socket, reader, `RCPT TO:<${settings.to}>`);
    await expectOk(socket, reader, "DATA");
    const fromName = settings.fromName.replace(/["\r\n]/g, "");
    const subject = String(settings.subject || "").replace(/[\r\n]/g, " ");
    const body = String(settings.body || "").replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
    socket.write(`From: "${fromName}" <${settings.fromEmail}>\r\n`);
    socket.write(`To: <${settings.to}>\r\n`);
    socket.write(`Subject: ${subject}\r\n`);
    socket.write("MIME-Version: 1.0\r\n");
    socket.write("Content-Type: text/plain; charset=utf-8\r\n");
    socket.write("\r\n");
    socket.write(`${body}\r\n.\r\n`);
    await expectOk(socket, reader, null);
    await expectOk(socket, reader, "QUIT");
  } finally {
    socket.end();
  }
}
