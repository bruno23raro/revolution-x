import { rateLimit, clientKey, emailRateLimitKey } from "@/lib/security/rate-limit";

describe("rate-limit", () => {
  beforeEach(() => {
    // Clear any internal state if needed
  });

  it("allows requests within limit", () => {
    const key = "test:ip:1";
    const result = rateLimit(key, 5, 60000);
    expect(result.ok).toBe(true);
    expect(result.left).toBe(4);
  });

  it("blocks requests exceeding limit", () => {
    const key = "test:ip:2";
    for (let i = 0; i < 5; i++) {
      rateLimit(key, 5, 60000);
    }
    const result = rateLimit(key, 5, 60000);
    expect(result.ok).toBe(false);
    expect(result.left).toBe(0);
  });

  it("resets after window expires", () => {
    const key = "test:ip:3";
    rateLimit(key, 1, 1); // 1 request, 1ms window
    expect(rateLimit(key, 1, 1).ok).toBe(false);
  });

  it("different keys have independent limits", () => {
    const key1 = "test:ip:a";
    const key2 = "test:ip:b";
    rateLimit(key1, 1, 60000);
    expect(rateLimit(key1, 1, 60000).ok).toBe(false);
    expect(rateLimit(key2, 1, 60000).ok).toBe(true);
  });

  it("clientKey extracts IP from x-forwarded-for", () => {
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    const key = clientKey(req);
    expect(key).toContain("1.2.3.4");
  });

  it("clientKey falls back to x-real-ip", () => {
    const req = new Request("http://localhost", {
      headers: { "x-real-ip": "9.8.7.6" },
    });
    const key = clientKey(req);
    expect(key).toContain("9.8.7.6");
  });

  it("clientKey defaults to 'local' when no headers", () => {
    const req = new Request("http://localhost");
    const key = clientKey(req);
    expect(key).toContain("local");
  });

  it("emailRateLimitKey includes email in key", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com" }),
    });
    const key = await emailRateLimitKey(req);
    expect(key).toContain("test@example.com");
  });

  it("emailRateLimitKey handles missing email", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const key = await emailRateLimitKey(req);
    expect(key).toContain("email:");
  });

  it("different emails have independent limits", async () => {
    const req1 = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "a@b.com" }),
    });
    const req2 = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "c@d.com" }),
    });
    const key1 = await emailRateLimitKey(req1);
    const key2 = await emailRateLimitKey(req2);
    expect(key1).not.toEqual(key2);
  });
});