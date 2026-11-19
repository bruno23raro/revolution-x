import { securityHeaders } from "@/lib/security/headers";
describe("headers", () => {
  it("inclui CSP", () => { expect(Object.keys(securityHeaders)).toContain("Content-Security-Policy"); });
  it("inclui HSTS", () => { expect(securityHeaders["Strict-Transport-Security"]).toMatch(/max-age/); });
  it("bloqueia sniff", () => { expect(securityHeaders["X-Content-Type-Options"]).toBe("nosniff"); });
});
