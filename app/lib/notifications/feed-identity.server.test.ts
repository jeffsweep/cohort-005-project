import { createPublicKey, createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { feedIdentity } from "./feed-identity.server";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const signingKey = Buffer.from(privatePem).toString("base64");

const keys = {
  KNOCK_PUBLIC_API_KEY: "pk_test_123",
  KNOCK_SIGNING_KEY: signingKey,
  KNOCK_FEED_CHANNEL_ID: "feed-channel-1",
};

function decode(part: string) {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

function verifies(token: string) {
  const [header, payload, signature] = token.split(".");
  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${header}.${payload}`);
  return verifier.verify(
    createPublicKey(privatePem),
    Buffer.from(signature, "base64url")
  );
}

describe("feedIdentity", () => {
  it("signs a one-hour RS256 token for the user, with the Cadence id as text", () => {
    const now = new Date("2026-11-13T10:00:00Z");

    const identity = feedIdentity(7, keys, now);

    expect(identity).toEqual({
      userId: "7",
      userToken: expect.any(String),
      publicKey: "pk_test_123",
      feedChannelId: "feed-channel-1",
    });
    if (!identity) throw new Error("expected an identity");
    const [header, payload] = identity.userToken.split(".");
    expect(decode(header)).toEqual({ alg: "RS256", typ: "JWT" });
    const iat = Date.parse("2026-11-13T10:00:00Z") / 1000;
    expect(decode(payload)).toEqual({ sub: "7", iat, exp: iat + 3600 });
    expect(verifies(identity.userToken)).toBe(true);
  });

  it("accepts the signing key as plain PEM too", () => {
    const identity = feedIdentity(7, { ...keys, KNOCK_SIGNING_KEY: privatePem });

    expect(verifies(identity?.userToken ?? "")).toBe(true);
  });

  it("is null without the signing key, even when the public key is set", () => {
    expect(feedIdentity(7, { ...keys, KNOCK_SIGNING_KEY: undefined })).toBeNull();
  });

  it("is null without the public key", () => {
    expect(feedIdentity(7, { ...keys, KNOCK_PUBLIC_API_KEY: "" })).toBeNull();
  });
});
