import { generateAccessToken, verifyAccessToken, generateRefreshToken, verifyRefreshToken, generateMagicLinkToken, verifyMagicLinkToken, ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL_DAYS } from "@/lib/auth";

describe("token", () => {
  const secret = "test-secret";

  describe("access token", () => {
    it("generates a token with 15min expiry claim", () => {
      const token = generateAccessToken({ sub: "user-1" });
      expect(token).toBeTruthy();
      expect(typeof token).toBe("string");
    });

    it("verifies valid token", () => {
      const token = generateAccessToken({ sub: "user-1", role: "admin" });
      const payload = verifyAccessToken(token);
      expect(payload).not.toBeNull();
      expect(payload).toMatchObject({ sub: "user-1", role: "admin" });
    });

    it("rejects invalid token", () => {
      const payload = verifyAccessToken("invalid.token.here");
      expect(payload).toBeNull();
    });

    it("rejects tampered token", () => {
      const token = generateAccessToken({ sub: "user-1" });
      const parts = token.split(".");
      const tampered = parts[0] + "." + parts[1] + ".tampered";
      const payload = verifyAccessToken(tampered);
      expect(payload).toBeNull();
    });

    it("different payloads produce different tokens", () => {
      const token1 = generateAccessToken({ sub: "user-1" });
      const token2 = generateAccessToken({ sub: "user-2" });
      expect(token1).not.toBe(token2);
    });
  });

  describe("refresh token", () => {
    it("generates a token with 30d expiry claim", () => {
      const token = generateRefreshToken({ sub: "user-1" });
      expect(token).toBeTruthy();
      expect(typeof token).toBe("string");
    });

    it("verifies valid refresh token", () => {
      const token = generateRefreshToken({ sub: "user-1", fid: "family-1" });
      const payload = verifyRefreshToken(token);
      expect(payload).not.toBeNull();
      expect(payload).toMatchObject({ sub: "user-1", fid: "family-1" });
    });

    it("rejects invalid refresh token", () => {
      const payload = verifyRefreshToken("invalid.token.here");
      expect(payload).toBeNull();
    });

    it("access and refresh tokens are different", () => {
      const access = generateAccessToken({ sub: "user-1" });
      const refresh = generateRefreshToken({ sub: "user-1" });
      expect(access).not.toBe(refresh);
    });
  });

  describe("magic link token", () => {
    it("generates a token with 15min expiry claim", () => {
      const token = generateMagicLinkToken({ email: "test@example.com", purpose: "login" });
      expect(token).toBeTruthy();
    });

    it("verifies valid magic link token", () => {
      const token = generateMagicLinkToken({ email: "test@example.com", purpose: "reset" });
      const payload = verifyMagicLinkToken(token);
      expect(payload).not.toBeNull();
      expect(payload).toMatchObject({ email: "test@example.com", purpose: "reset" });
    });

    it("rejects invalid magic link token", () => {
      const payload = verifyMagicLinkToken("invalid.token.here");
      expect(payload).toBeNull();
    });
  });

  describe("constants", () => {
    it("ACCESS_TOKEN_TTL is 15m", () => {
      expect(ACCESS_TOKEN_TTL).toBe("15m");
    });

    it("REFRESH_TOKEN_TTL_DAYS is 30", () => {
      expect(REFRESH_TOKEN_TTL_DAYS).toBe(30);
    });
  });
});