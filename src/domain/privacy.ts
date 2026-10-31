/**
 * Phone numbers and emails are never shared through Kamra messages.
 * Indian mobile numbers (with or without +91/0, spaces, dashes, dots) and email addresses are masked.
 */
const PHONE = /(?<!\d)(?:(?:\+|00)\s*91[\s.-]*|0)?[6-9](?:[\s.-]*\d){9}(?!\d)/g;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const SPELLED = /\b(?:(?:zero|one|two|three|four|five|six|seven|eight|nine|oh)[\s,.-]*){10}\b/gi;

export function redactContacts(text: string): { text: string; redacted: boolean } {
  let redacted = false;
  const out = text
    .replace(PHONE, () => { redacted = true; return "[number hidden]"; })
    .replace(EMAIL, () => { redacted = true; return "[email hidden]"; })
    .replace(SPELLED, () => { redacted = true; return "[number hidden]"; });
  return { text: out, redacted };
}
