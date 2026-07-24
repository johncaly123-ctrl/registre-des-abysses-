import { test, expect } from "@playwright/test";
import { clearAppStorage, clickNav, clickSousNav } from "./fixtures.js";

test.beforeEach(async ({ page }) => {
  await clearAppStorage(page);
  await clickNav(page, "Muldo");
  await clickSousNav(page, "🐴 Cheptel");
});

test("coller un texte façon capture OCR reconnaît les couleurs et importe au cheptel", async ({ page }) => {
  const panel = page.locator(".main-view");
  const textarea = panel.locator("textarea");
  await textarea.fill("Muldo Doré 3\nMuldo Amande 2");

  await expect(panel.getByText(/muldo\(s\) reconnu\(s\)/)).toBeVisible();

  await panel.getByRole("button", { name: "Importer" }).click();

  await expect(page.getByText(/muldo\(s\) importé\(s\) depuis la capture/)).toBeVisible();
});
