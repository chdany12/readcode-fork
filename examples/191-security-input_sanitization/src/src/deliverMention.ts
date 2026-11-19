import { renderMentionEmail, MentionNotification } from "./renderMention";

export interface Mailer {
  send(mail: { to: string; subject: string; html: string; text: string }): Promise<void>;
}

export interface Prefs {
  emailMentionsEnabled(email: string): Promise<boolean>;
}

export async function deliverMention(
  mailer: Mailer,
  prefs: Prefs,
  n: MentionNotification,
): Promise<"sent" | "skipped"> {
  if (!(await prefs.emailMentionsEnabled(n.recipientEmail))) {
    return "skipped";
  }
  const mail = renderMentionEmail(n);
  await mailer.send(mail);
  return "sent";
}
