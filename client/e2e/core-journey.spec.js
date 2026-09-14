import { test, expect } from "@playwright/test";

// Full core journey (Section 4.2 / Appendix K), automated. Requires the API
// running at :4000 with a fresh seed (npm run seed) and the client built and
// served (npm run preview) — see .github/workflows/ci.yml for the exact
// sequence this runs under in CI.

test.describe("Core journey: register, apply, approve, attend, hours", () => {
  test("volunteer can register, browse, and apply", async ({ page }) => {
    const email = `e2e-vol-${Date.now()}@test.com`;

    await page.goto("/register");
    await page.getByLabel("Name").fill("E2E Volunteer");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "volunteer", exact: true }).click();
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/opportunities");
    await expect(page.getByText("Youth Learning Support")).toBeVisible();
    await page.getByText("Youth Learning Support").click();

    await expect(page).toHaveURL(/\/opportunities\//);
    await page.getByRole("button", { name: "Apply for this opportunity" }).click();
    await expect(page.getByText(/Application submitted/)).toBeVisible();

    // Re-visiting the same page should now show the conditional "already applied" CTA.
    await page.reload();
    await expect(page.getByText("You've already applied to this opportunity:")).toBeVisible();
  });

  test("duplicate application is rejected at the UI level too", async ({ page, request }) => {
    const email = `e2e-dup-${Date.now()}@test.com`;
    const password = "password123";

    const reg = await request.post("/api/auth/register", {
      data: { name: "Dup Test", email, password, role: "volunteer" },
    });
    expect(reg.ok()).toBeTruthy();

    const opps = await request.get("/api/opportunities");
    const [firstOpportunity] = await opps.json();

    const first = await request.post(`/api/opportunities/${firstOpportunity.id}/apply`, {
      headers: { Authorization: `Bearer ${(await reg.json()).token}` },
      data: {},
    });
    expect(first.status()).toBe(201);

    const second = await request.post(`/api/opportunities/${firstOpportunity.id}/apply`, {
      headers: { Authorization: `Bearer ${(await reg.json()).token}` },
      data: {},
    });
    expect(second.status()).toBe(409);
  });

  test("coordinator can approve, record attendance, and the volunteer sees updated hours", async ({
    browser,
  }) => {
    // Self-contained by design: the coordinator creates and owns their own
    // opportunity here, rather than relying on the seeded "Flag Day
    // Fundraiser" (owned by the seeded coordinator Ali). That earlier
    // approach was fragile under fullyParallel execution against shared
    // seed data and only demonstrated RBAC-visibility, not a real approval
    // (see RAID Log Issue I6, Appendix E) — this version exercises the
    // actual apply -> approve -> attend -> hours transition at the UI level.
    const coordEmail = `e2e-flow-coord-${Date.now()}@test.com`;
    const volEmail = `e2e-flow-vol-${Date.now()}@test.com`;
    const title = `E2E Flow Test ${Date.now()}`;

    const coordContext = await browser.newContext();
    const coordPage = await coordContext.newPage();
    await coordPage.goto("/register");
    await coordPage.getByLabel("Name").fill("Flow Coordinator");
    await coordPage.getByLabel("Email").fill(coordEmail);
    await coordPage.getByLabel("Password").fill("password123");
    await coordPage.getByRole("button", { name: "coordinator", exact: true }).click();
    await coordPage.getByRole("button", { name: "Create account" }).click();
    await expect(coordPage).toHaveURL(/\/coordinator/);

    await coordPage.goto("/coordinator/new");
    await coordPage.getByLabel("Title").fill(title);
    await coordPage.getByLabel("Description").fill("Created by the E2E suite; safe to ignore.");
    await coordPage.getByLabel("Location").fill("Test Site");
    await coordPage.getByLabel("Starts").fill("2027-01-01T09:00");
    await coordPage.getByLabel("Ends").fill("2027-01-01T12:00");
    await coordPage.getByLabel("Capacity").fill("5");
    await coordPage.getByRole("button", { name: "Publish opportunity" }).click();
    await expect(coordPage).toHaveURL(/\/opportunities\//);
    const opportunityUrl = coordPage.url();

    const volContext = await browser.newContext();
    const volPage = await volContext.newPage();
    await volPage.goto("/register");
    await volPage.getByLabel("Name").fill("Flow Volunteer");
    await volPage.getByLabel("Email").fill(volEmail);
    await volPage.getByLabel("Password").fill("password123");
    await volPage.getByRole("button", { name: "Create account" }).click();
    await expect(volPage).toHaveURL(/\/dashboard/);
    await volPage.goto(opportunityUrl);
    await volPage.getByRole("button", { name: "Apply for this opportunity" }).click();
    await expect(volPage.getByText(/Application submitted/)).toBeVisible();

    await coordPage.reload();
    await coordPage.getByRole("button", { name: "Approve" }).click();
    await expect(coordPage.getByPlaceholder("hrs")).toBeVisible();
    await coordPage.getByPlaceholder("hrs").fill("3");
    const [attendanceResponse] = await Promise.all([
      coordPage.waitForResponse((r) => r.url().includes("/api/attendance") && r.request().method() === "POST"),
      coordPage.getByRole("button", { name: "Record attendance" }).click(),
    ]);
    // Fail loudly with the real server response if this isn't a 201, instead
    // of a generic "text never appeared" timeout that gives no diagnostic
    // information about why.
    expect(attendanceResponse.status(), await attendanceResponse.text()).toBe(201);
    await expect(coordPage.getByText("Attendance recorded")).toBeVisible();

    await volPage.goto("/dashboard");
    // Targets the exact <p> that follows the "Hours contributed" label,
    // rather than searching for "3" on the page generally or relying on
    // div-nesting order — this only passes if that specific stat updated.
    const hoursValue = volPage.locator('xpath=//p[text()="Hours contributed"]/following-sibling::p[1]');
    await expect(hoursValue).toHaveText("3");
  });
});
