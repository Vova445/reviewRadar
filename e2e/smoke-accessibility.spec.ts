import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "http://localhost:4000";

async function expectAccessible(page: Page, checkpoint: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const serious = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
  expect(serious.map((violation) => `${violation.impact}: ${violation.id} — ${violation.help}: ${violation.nodes.map((node) => `${node.target.join(" ")} ${node.failureSummary ?? ""}`).join(" | ")}`), `${checkpoint} has serious or critical accessibility issues`).toEqual([]);
}

test("register, login, mock Google, sync and open the dashboard", async ({ page }) => {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `smoke-${unique}@example.test`;
  const name = `Smoke ${unique}`;
  const password = "Smoke-test-2026!";
  const onboarding = {
    user: { email, name },
    workspace: { name: `${name} Workspace` },
    state: { currentStep: 1, completedSteps: [] as number[], selectedLocationIds: [] as string[] },
    connection: "disconnected",
    locations: [{ id: "smoke-location", name: "Northwind Cafe", provider_location_id: "accounts/123/locations/456", city: "Kyiv", country: "UA", selected: 0 }],
    sync: { jobs: [] as { status: string; count: number }[], reviews: 0 },
  };

  await page.route("**/api/onboarding", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: onboarding });
    const input = route.request().postDataJSON() as { step: number; completed: boolean; selectedLocationIds?: string[] };
    onboarding.state.completedSteps = input.completed ? [...new Set([...onboarding.state.completedSteps, input.step])] : onboarding.state.completedSteps.filter((step) => step !== input.step);
    onboarding.state.currentStep = input.completed ? Math.min(4, input.step + 1) : input.step;
    if (input.selectedLocationIds) onboarding.state.selectedLocationIds = input.selectedLocationIds;
    return route.fulfill({ json: { ok: true, currentStep: onboarding.state.currentStep, completedSteps: onboarding.state.completedSteps } });
  });
  await page.route("**/v1/integrations/google/connect", (route) => route.fulfill({ json: { url: "https://accounts.google.com/o/oauth2/v2/auth?client_id=mock&state=smoke" } }));
  await page.route("https://accounts.google.com/**", async (route) => {
    onboarding.connection = "connected";
    return route.fulfill({ status: 302, headers: { location: `${baseURL}/onboarding?step=3` } });
  });
  await page.route("**/v1/integrations/google/locations", async (route) => {
    if (route.request().method() === "POST") {
      const input = route.request().postDataJSON() as { locations: string[] };
      onboarding.locations = onboarding.locations.map((location) => ({ ...location, selected: input.locations.includes(location.provider_location_id) ? 1 : 0 }));
      onboarding.sync = { jobs: [{ status: "completed", count: 1 }], reviews: 3 };
      return route.fulfill({ status: 202, json: { ok: true, selected: input.locations.length, jobs: ["smoke-sync"], jobId: "smoke-sync" } });
    }
    return route.fulfill({ json: { connected: true, locations: onboarding.locations } });
  });

  await page.goto("/auth?mode=signup");
  await expect(page.getByRole("heading", { name: "Створити акаунт" })).toBeVisible();
  await expectAccessible(page, "sign-up page");
  await page.getByPlaceholder("Ваше ім’я").fill(name);
  await page.getByPlaceholder("name@company.com").fill(email);
  await page.getByPlaceholder("Мінімум 8 символів").fill(password);
  const registrationResponse = page.waitForResponse((response) => response.url().includes("/api/auth/register"));
  await page.getByRole("button", { name: "Створити акаунт" }).click();
  expect((await registrationResponse).status()).toBe(200);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: new RegExp(name) })).toBeVisible();
  await expectAccessible(page, "dashboard after registration");

  await page.evaluate(async () => { await fetch("/api/auth/logout", { method: "POST" }); });
  await page.goto("/auth");
  await expect(page.getByRole("heading", { name: "Увійти в ReviewRadar" })).toBeVisible();
  await expectAccessible(page, "sign-in page");
  await page.getByPlaceholder("name@company.com").fill(email);
  await page.getByPlaceholder("Мінімум 8 символів").fill(password);
  await page.getByRole("button", { name: "Увійти" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { name: "Ваш акаунт" })).toBeVisible();
  await expectAccessible(page, "onboarding account step");
  await page.getByRole("button", { name: /Продовжити/ }).click();
  await expect(page.getByRole("heading", { name: "Підключіть Google" })).toBeVisible();
  await expectAccessible(page, "onboarding Google step");
  await page.getByRole("button", { name: /Підключити Google/ }).click();

  await expect(page.getByRole("heading", { name: "Оберіть локації" })).toBeVisible();
  await expectAccessible(page, "onboarding locations step");
  await page.getByRole("button").filter({ hasText: "Northwind Cafe" }).click();
  await page.getByRole("button", { name: /Обрати локації/ }).click();
  await expect(page.getByRole("heading", { name: "Готуємо перший звіт" })).toBeVisible();
  await expect(page.getByText("100%", { exact: true })).toBeVisible();
  await expectAccessible(page, "onboarding sync progress");
  await page.getByRole("link", { name: /Перейти до панелі/ }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: new RegExp(name) })).toBeVisible();
  await expectAccessible(page, "dashboard after sync");
});

test("shows an actionable error for an invalid OAuth state", async ({ page }) => {
  const email = `oauth-state-${Date.now()}@example.test`;
  await page.goto("/auth?mode=signup");
  await page.getByPlaceholder("Ваше ім’я").fill("OAuth State Smoke");
  await page.getByPlaceholder("name@company.com").fill(email);
  await page.getByPlaceholder("Мінімум 8 символів").fill("Smoke-test-2026!");
  const registrationResponse = page.waitForResponse((response) => response.url().includes("/api/auth/register"));
  await page.getByRole("button", { name: "Створити акаунт" }).click();
  expect((await registrationResponse).status()).toBe(200);
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/v1/integrations/google/callback?code=mock-code&state=invalid-state");
  await expect(page).toHaveURL(/\/integrations\/google\/locations\?error=INVALID_OAUTH_STATE$/);
  await expect(page.getByText("Спроба підключення застаріла")).toBeVisible();
  await expectAccessible(page, "invalid OAuth state page");
});
