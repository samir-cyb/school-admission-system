/** Birth registration numbers (জন্ম নিবন্ধন নম্বর) are exactly 17 digits. */
export const STUDENT_ID_LENGTH = 17;

const BANGLA_ZERO = 0x09e6; // ০

/**
 * Turns whatever the guardian typed into ASCII digits:
 * Bangla digits ০-৯ become 0-9, spaces/dashes and anything else are dropped.
 * The API only accepts ASCII digits, so this runs before every request.
 */
export function normalizeStudentId(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    if (code >= 0x30 && code <= 0x39) out += ch;
    else if (code >= BANGLA_ZERO && code <= BANGLA_ZERO + 9) out += String(code - BANGLA_ZERO);
  }
  return out.slice(0, STUDENT_ID_LENGTH);
}

export function isValidStudentId(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[0-9]{17}$/.test(value);
}

/** 20152691234567890 → "2015 2691 2345 67890" (year first, easier to compare with the certificate). */
export function groupStudentId(value: string): string {
  return [value.slice(0, 4), value.slice(4, 8), value.slice(8, 12), value.slice(12)].filter(Boolean).join(" ");
}

/** 20152691234567890 → "2015 •••• •••• 67890" for places where the full number is not needed. */
export function maskStudentId(value: string): string {
  if (value.length !== STUDENT_ID_LENGTH) return value;
  return `${value.slice(0, 4)} •••• •••• ${value.slice(12)}`;
}
