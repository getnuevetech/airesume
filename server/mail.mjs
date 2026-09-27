import net from "node:net";
import tls from "node:tls";
import { db, id } from "./db.mjs";

export function mailSettings() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'smtp'").get();
  const saved = row ? JSON.parse(row.value) : {};
  const port = Number(saved.port || process.env.SMTP_PORT || 587);
  return {
    host: String(saved.host || process.env.SMTP_HOST || "").trim(),
    port: Number.isFinite(port) && port > 0 ? port : 587,
    secure: saved.secure === true || process.env.SMTP_SECURE === "true" || port === 465,
    user: String(saved.user || process.env.SMTP_USER || ""),
    password: String(saved.password || process.env.SMTP_PASSWORD || ""),
    fromEmail: String(saved.fromEmail || process.env.SMTP_FROM || "").trim(),
    fromName: String(saved.fromName || "JobPilot").trim() || "JobPilot",
  };
}

export function publicMailSettings() {
  const settings = mailSettings();
  return {
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    user: settings.user,
    fromEmail: settings.fromEmail,
    fromName: settings.fromName,
    hasPassword: Boolean(settings.password),
    configured: Boolean(settings.host && settings.fromEmail),
  };
}

export function saveMailSettings(input) {
  const current = mailSettings();
  const port = Number(input.port);
  const next = {
    host: String(input.host ?? current.host).trim(),
    port: Number.isFinite(port) && port > 0 ? port : current.port,
    secure: Boolean(input.secure),
    user: String(input.user ?? current.user),
    password: input.password && !String(input.password).startsWith("••••") ? String(input.password) : current.password,
    fromEmail: String(input.fromEmail ?? current.fromEmail).trim(),
    fromName: String(input.fromName ?? current.fromName).trim() || "JobPilot",
  };
  db.prepare("INSERT INTO settings (key, value) VALUES ('smtp', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(JSON.stringify(next));
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

async function expectOk(socket, reader, line) {
  if (line != null) socket.write(`${line}\r\n`);
  const text = await reader.read();
  const code = Number(String(text).slice(0, 3));
  if (code >= 400) throw new Error(String(text).trim().slice(0, 300));
  return { code, text };
}

function openSocket(settings) {
  return new Promise((resolve, reject) => {
    const socket = settings.secure
      ? tls.connect({ host: settings.host, port: settings.port, servername: settings.host })
      : net.connect({ host: settings.host, port: settings.port });
    const reader = attachReader(socket);
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("The mail server did not respond."));
    }, 15000);
    socket.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    socket.once(settings.secure ? "secureConnect" : "connect", () => {
      clearTimeout(timer);
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
