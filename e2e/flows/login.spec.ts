import { test, expect } from "@playwright/test";

test("login renderiza formulario", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel(/e-?mail/i)).toBeVisible();
  await expect(page.getByLabel(/senha/i)).toBeVisible();
});

test("login exige e-mail valido", async ({ page }) => {
  await page.goto("/login");
  // Disable browser native validation to test server-side validation
  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) form.setAttribute('novalidate', 'true');
  });
  await page.getByLabel(/e-?mail/i).fill("invalido");
  await page.getByRole("button", { name: /entrar/i }).click();
  // Check for field-specific error message under email field
  await expect(page.getByText(/e-mail invalido/i)).toBeVisible({ timeout: 10000 });
});