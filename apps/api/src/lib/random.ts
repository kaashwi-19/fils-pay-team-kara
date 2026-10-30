import { randomInt } from "node:crypto";

// Every value here guards something — OTP codes, payment-link tokens, invite
// codes — so it must come from the operating system's cryptographic random
// source (crypto.randomInt). Math.random() is a predictable PRNG: its output
// can be reconstructed from a handful of observed values.

/** Generates a string of `n` random decimal digits (e.g. "042817"). */
export function randomDigits(n: number): string {
  return randomInt(0, 10 ** n)
    .toString()
    .padStart(n, "0");
}

/** Generates a string of `n` characters drawn uniformly from `alphabet`. */
export function randomFromAlphabet(alphabet: string, n: number): string {
  let out = "";
  for (let i = 0; i < n; i++) {
    out += alphabet[randomInt(0, alphabet.length)];
  }
  return out;
}

/** Short display-only reference for receipts and logs (e.g. "FP-A7K2M3"). */
export function displayReference(): string {
  return `FP-${randomFromAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6)}`;
}
