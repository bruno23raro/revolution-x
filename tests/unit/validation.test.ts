import { emailSchema, passwordSchema, slugSchema } from "@/lib/validation/schemas";
describe("validacao", () => {
  it("rejeita e-mail invalido", () => { expect(emailSchema.safeParse("x@").success).toBe(false); });
  it("normaliza e-mail", () => { expect(emailSchema.parse(" A@B.COM ")).toBe("a@b.com"); });
  it("exige senha forte", () => { expect(passwordSchema.safeParse("12345678").success).toBe(false); });
  it("aceita senha valida", () => { expect(passwordSchema.safeParse("Abc12345!x").success).toBe(true); });
  it("slug so minusculo e hifen", () => { expect(slugSchema.safeParse("Meu Slug").success).toBe(false); });
});
