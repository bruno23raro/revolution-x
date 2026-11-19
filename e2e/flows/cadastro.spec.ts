import { test, expect } from "@playwright/test";
test("cadastro renderiza formulario", async ({ page }) => {
  await page.goto("/register");
  await expect(page.getByLabel(/e-?mail/i)).toBeVisible();
  await page.getByLabel(/e-?mail/i).fill("qa+e2e@example.com");
  await page.getByRole("button", { name: /enviar|continuar|criar|cadastrar/i }).first().click();
});
