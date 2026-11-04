import { expect, test } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "http://localhost:4000";

test("resumes the four-step onboarding through mocked Google OAuth and sync", async ({ page }) => {
  const model = {
    user: { email: "owner@example.com", name: "Alex Owner" },
    workspace: { name: "Alex Workspace" },
    state: { currentStep: 1, completedSteps: [] as number[], selectedLocationIds: [] as string[] },
    connection: "disconnected",
    locations: [{ id: "location-1", name: "Northwind Cafe", provider_location_id: "accounts/123/locations/456", city: "Kyiv", country: "UA", selected: 0 }],
    sync: { jobs: [] as { status: string; count: number }[], reviews: 0 },
  };

  await page.route("**/api/onboarding", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: model });
    const input = route.request().postDataJSON() as { step: number; completed: boolean; selectedLocationIds?: string[] };
    model.state.completedSteps = input.completed ? [...new Set([...model.state.completedSteps, input.step])] : model.state.completedSteps.filter((step) => step !== input.step);
    model.state.currentStep = input.completed ? Math.min(4, input.step + 1) : input.step;
    if (input.selectedLocationIds) model.state.selectedLocationIds = input.selectedLocationIds;
    return route.fulfill({ json: { ok: true, currentStep: model.state.currentStep, completedSteps: model.state.completedSteps } });
  });

  await page.route("**/v1/integrations/google/connect", (route) => route.fulfill({ json: { url: "https://accounts.google.com/o/oauth2/v2/auth?client_id=mock&state=mock" } }));
  await page.route("https://accounts.google.com/**", async (route) => {
    model.connection = "connected";
    return route.fulfill({ status: 302, headers: { location: `${baseURL}/onboarding?step=3` } });
  });
  await page.route("**/v1/integrations/google/locations", async (route) => {
    if (route.request().method() === "POST") {
      const input = route.request().postDataJSON() as { locations: string[] };
      model.locations = model.locations.map((item) => ({ ...item, selected: input.locations.includes(item.provider_location_id) ? 1 : 0 }));
      model.sync = { jobs: [{ status: "completed", count: 1 }], reviews: 17 };
      return route.fulfill({ status: 202, json: { ok: true, selected: input.locations.length, jobs: ["sync-1"], jobId: "sync-1" } });
    }
    return route.fulfill({ json: { connected: true, locations: model.locations } });
  });

  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { name: "Ваш акаунт" })).toBeVisible();
  await page.getByRole("button", { name: /Продовжити/ }).click();
  await expect(page.getByRole("heading", { name: "Підключіть Google" })).toBeVisible();
  await page.getByRole("button", { name: /Підключити Google/ }).click();

  await expect(page.getByRole("heading", { name: "Оберіть локації" })).toBeVisible();
  await expect(page.getByText("Northwind Cafe")).toBeVisible();
  await page.getByRole("button").filter({ hasText: "Northwind Cafe" }).click();
  await page.getByRole("button", { name: /Обрати локації/ }).click();
  await expect(page.getByRole("heading", { name: "Готуємо перший звіт" })).toBeVisible();
  await expect(page.getByText("100%", { exact: true })).toBeVisible();
  await expect(page.getByText("17 відгуків отримано")).toBeVisible();

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Готуємо перший звіт" })).toBeVisible();
  await expect(page.getByText("17 відгуків отримано")).toBeVisible();
});
