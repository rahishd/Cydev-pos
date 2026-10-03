const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "@#$%&*!?";

function pick(set: string): string {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return set[buf[0] % set.length];
}

/** 10 chars with upper, lower, digit and symbol; ambiguous characters (0/O, 1/l/I) are left out. */
export function generatePassword(length = 10): string {
  const all = UPPER + LOWER + DIGITS + SYMBOLS;
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    const j = buf[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export const MIN_PASSWORD_LENGTH = 6;

/** Returns a message when the password breaks the shop's rules, otherwise null. */
export function passwordProblem(
  password: string,
  rules: { passwordMinLength?: unknown; passwordComplexity?: unknown }
): string | null {
  const min = Number(rules.passwordMinLength) || MIN_PASSWORD_LENGTH;
  if (password.length < min) return `Password must be at least ${min} characters`;
  if (rules.passwordComplexity && !(/[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password))) {
    return "Password needs an upper-case letter, a lower-case letter and a number";
  }
  return null;
}
