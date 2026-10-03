/**
 * Reduces a phone number to the digits that identify it, so "+977 980-123-4567",
 * "9801234567" and "00977 9801234567" are all the same sign-in number.
 * Returns "" when there aren't enough digits to be a phone number.
 */
export function normalizePhone(input: string | null | undefined): string {
  let digits = (input ?? "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("977") && digits.length >= 12) digits = digits.slice(3);
  if (digits.length > 10) digits = digits.slice(-10);
  return digits.length >= 7 ? digits : "";
}

/** Hides the middle of a number so it can sit in logs without exposing it. */
export function maskPhone(input: string): string {
  const d = input.replace(/\D/g, "");
  return d.length > 5 ? `${d.slice(0, 2)}${"•".repeat(d.length - 5)}${d.slice(-3)}` : "•••";
}
