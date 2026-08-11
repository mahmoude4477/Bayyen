import { describe, expect, it } from "vitest";
import { signBody, verifyBody } from "@/lib/server/hmac";

describe("service HMAC", () => {
  it("verifies the raw body and rejects tampering", () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const input = { rawBody: '{"runId":"r1"}', key: "a-secret-key-with-enough-entropy", timestamp, nonce: "fixed-nonce" };
    const signature = signBody(input.rawBody, input.key, input.timestamp, input.nonce);
    expect(verifyBody({ ...input, signature })).toBe(true);
    expect(verifyBody({ ...input, rawBody: '{"runId":"r2"}', signature })).toBe(false);
  });

  it("rejects stale timestamps", () => {
    const timestamp = String(Math.floor(Date.now() / 1000) - 301);
    const rawBody = "{}";
    const key = "a-secret-key-with-enough-entropy";
    const nonce = "stale";
    expect(verifyBody({ rawBody, key, nonce, timestamp, signature: signBody(rawBody, key, timestamp, nonce) })).toBe(false);
  });
});
