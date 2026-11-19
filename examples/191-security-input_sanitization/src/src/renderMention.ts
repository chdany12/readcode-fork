import { clampLength, escapeHtml, stripControlChars } from "./sanitize";

export interface MentionNotification {
  recipientEmail: string;
  senderDisplayName: string;
  channelName: string;
  messageText: string;
  messageUrl: string;
}

export interface RenderedEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const APP_ORIGIN = "https://chat.example.com";

function safeLink(url: string): string {
  const parsed = new URL(url, APP_ORIGIN);
  if (parsed.origin !== APP_ORIGIN) {
    return APP_ORIGIN;
  }
  return parsed.toString();
}

export function renderMentionEmail(n: MentionNotification): RenderedEmail {
  const sender = clampLength(stripControlChars(n.senderDisplayName), 64);
  const channel = clampLength(stripControlChars(n.channelName), 80);
  const preview = clampLength(n.messageText.trim(), 280);
  const link = safeLink(n.messageUrl);

  const subject = `${sender} mentioned you in #${channel}`;

  const html = [
    `<p><strong>${escapeHtml(sender)}</strong> mentioned you in`,
    ` <strong>#${channel}</strong>:</p>`,
    `<blockquote>${escapeHtml(preview).replace(/\n/g, "<br>")}</blockquote>`,
    `<p><a href="${escapeHtml(link)}">Open the conversation</a></p>`,
  ].join("");

  const text = [
    `${sender} mentioned you in #${channel}:`,
    "",
    preview,
    "",
    `Open the conversation: ${link}`,
  ].join("\n");

  return { to: n.recipientEmail, subject, html, text };
}
