/** Mentions are stored inline as @[Display Name](userId). Pure helpers — unit tested. */
const RE = /@\[([^\]]{1,80})\]\(([a-z0-9]{10,40})\)/g;
export function extractMentions(body: string) {
  return [...new Set([...body.matchAll(RE)].map((m) => m[2]))];
}
/** Plain text for emails/notifications: "@[Asha Rao](id)" → "@Asha Rao" */
export function plainText(body: string) {
  return body.replace(RE, '@$1');
}
