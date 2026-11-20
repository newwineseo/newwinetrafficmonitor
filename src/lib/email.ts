// One sendEmail() for the whole app. EMAIL_PROVIDER picks the transport: "gmail" (default) or "resend".
import nodemailer from "nodemailer";

export interface EmailMessage {
  to: string[];
  bcc?: string[];
  subject: string;
  text: string;
  html: string;
}

export interface EmailResult {
  /** "logged" when no credentials are set and the email was printed to the console instead. */
  status: "sent" | "logged";
  id?: string;
}

function fromHeader() {
  const name = process.env.EMAIL_FROM_NAME || "NewWine Traffic Monitor";
  const user = process.env.GMAIL_USER || "newwineseo@gmail.com";
  return { name, user, header: `"${name}" <${user}>` };
}

function logToConsole(msg: EmailMessage, why: string): EmailResult {
  console.log(`[email] ${why}; logging instead of sending.\nTo: ${msg.to.join(", ")}\n` +
    `${msg.bcc?.length ? `Bcc: ${msg.bcc.join(", ")}\n` : ""}Subject: ${msg.subject}\n\n${msg.text}\n[email] end`);
  return { status: "logged" };
}

async function sendViaGmail(msg: EmailMessage): Promise<EmailResult> {
  const pass = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");
  if (!pass) return logToConsole(msg, "GMAIL_APP_PASSWORD is empty");
  const { user, header } = fromHeader();
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass },
  });
  // Gmail rewrites any other From address, so always send as the authenticated account.
  const info = await transport.sendMail({ from: header, to: msg.to, bcc: msg.bcc, subject: msg.subject, text: msg.text, html: msg.html });
  return { status: "sent", id: info.messageId };
}

async function sendViaResend(msg: EmailMessage): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return logToConsole(msg, "RESEND_API_KEY is empty");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: fromHeader().header, to: msg.to, bcc: msg.bcc, subject: msg.subject, text: msg.text, html: msg.html }),
  });
  if (!res.ok) throw new Error(`Resend error ${res.status}: ${await res.text()}`);
  return { status: "sent", id: (await res.json()).id };
}

export async function sendEmail(msg: EmailMessage): Promise<EmailResult> {
  if (!msg.to.length && !msg.bcc?.length) throw new Error("No email recipients configured");
  const provider = (process.env.EMAIL_PROVIDER || "gmail").toLowerCase();
  if (provider === "resend") return sendViaResend(msg);
  if (provider === "gmail") return sendViaGmail(msg);
  throw new Error(`Unknown EMAIL_PROVIDER "${provider}" (use gmail or resend)`);
}
