export const WHITE_LABEL_EMAIL_DOMAIN = 'pulsecare.os';

/** Build a white-labeled demo/test email. Always uses @pulsecare.os. */
export function whiteLabelEmail(localPart: string): string {
  const local = localPart
    .trim()
    .toLowerCase()
    .replace(/@.*$/, '')
    .replace(/[^a-z0-9._+-]/g, '.');
  const safeLocal = local || 'user';
  return `${safeLocal}@${WHITE_LABEL_EMAIL_DOMAIN}`;
}

export function isWhiteLabelEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${WHITE_LABEL_EMAIL_DOMAIN}`);
}
