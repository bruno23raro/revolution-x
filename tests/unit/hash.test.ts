import { hashPassword, verifyPassword, isPasswordStrong, BCRYPT_COST } from "@/lib/auth";

describe("hash", () => {
  it("bcrypt cost is 12", () => {
    expect(BCRYPT_COST).toBe(12);
  });

  it("hashes password without storing plaintext", async () => {
    const password = "Strong123!x";
    const hash = await hashPassword(password);
    expect(hash).not.toBe(password);
    expect(hash).toMatch(/^\$2[aby]\$12\$/); // bcrypt with cost 12
  });

  it("verifies correct password", async () => {
    const password = "Strong123!x";
    const hash = await hashPassword(password);
    expect(await verifyPassword(password, hash)).toBe(true);
  });

  it("rejects incorrect password", async () => {
    const password = "Strong123!x";
    const hash = await hashPassword(password);
    expect(await verifyPassword("Wrong123!x", hash)).toBe(false);
  });

  it("different passwords produce different hashes", async () => {
    const password = "Strong123!x";
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);
    expect(hash1).not.toBe(hash2); // bcrypt uses salt
  });

  it("password strength validation", () => {
    expect(isPasswordStrong("weak")).toBe(false);
    expect(isPasswordStrong("12345678")).toBe(false);
    expect(isPasswordStrong("password")).toBe(false);
    expect(isPasswordStrong("Password")).toBe(false);
    expect(isPasswordStrong("Password1")).toBe(false);
    expect(isPasswordStrong("Password1!")).toBe(true);
    expect(isPasswordStrong("Strong123!x")).toBe(true);
    expect(isPasswordStrong("Abc12345!x")).toBe(true);
  });
});