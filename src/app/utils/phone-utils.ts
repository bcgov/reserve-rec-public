import { parsePhoneNumberFromString } from 'libphonenumber-js';

// Same rule as normalizePhoneNumber in reserve-rec-api src/layers/base/phone.js, which refuses at PreSignUp.
export function normalizePhone(value: string | null | undefined): string | null {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;

  const parsed = parsePhoneNumberFromString(trimmed, 'CA');
  if (parsed?.isValid()) return parsed.number;

  // An international number typed without its leading +.
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+') || digits.length < 12 || digits.length > 15) return null;
  const retried = parsePhoneNumberFromString(`+${digits}`);
  return retried?.isValid() ? retried.number : null;
}

// E.164 in, "+44 7911 123456" out.
export function formatInternationalPhone(e164: string): string {
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
}
