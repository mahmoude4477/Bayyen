import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const HMAC_WINDOW_SECONDS = 300;

function payload(timestamp: string, nonce: string, rawBody: string) {
  return `${timestamp}.${nonce}.${rawBody}`;
}

export function signBody(rawBody: string, key: string, timestamp: string, nonce: string) {
  return createHmac("sha256", key).update(payload(timestamp, nonce, rawBody)).digest("hex");
}

export function verifyBody(input: {
  rawBody: string;
  key: string;
  timestamp: string;
  nonce: string;
  signature: string;
}) {
  const seconds = Number(input.timestamp);
  if (!Number.isFinite(seconds) || Math.abs(Date.now() / 1000 - seconds) > HMAC_WINDOW_SECONDS) return false;
  const expected = Buffer.from(signBody(input.rawBody, input.key, input.timestamp, input.nonce), "hex");
  const received = Buffer.from(input.signature, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}
