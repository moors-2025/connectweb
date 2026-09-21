process.env.DB_PATH = ":memory:";
process.env.JWT_SECRET = "test-secret";
process.env.NODE_ENV = "test";

const test = require("node:test");
const assert = require("node:assert");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const app = require("../src/index");
const { db, uuid } = require("../src/db");
const { JWT_SECRET } = require("../src/middleware/auth");

async function registerAndLogin(role, email) {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ name: role, email, password: "password123", role });
  return res.body.token;
}

// /api/auth/register only accepts volunteer/coordinator (admins are seeded, not
// self-registered — see src/routes/auth.js), so admin test fixtures are inserted
// directly, the same way server/src/seed.js creates the real admin@example.com.
function createAdmin(name, email) {
  const id = uuid();
  db.prepare(
    "INSERT INTO users (id, name, email, passwordHash, role) VALUES (?, ?, ?, ?, 'admin')"
  ).run(id, name, email, bcrypt.hashSync("password123", 10));
  const token = jwt.sign({ id, role: "admin", email, name }, JWT_SECRET, { expiresIn: "7d" });
  return { id, token };
}

test("volunteer can register and log in", async () => {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ name: "Test Vol", email: "vol1@test.com", password: "password123", role: "volunteer" });
  assert.strictEqual(res.status, 201);
  assert.ok(res.body.token);
});

test("cannot register with a duplicate email", async () => {
  await request(app).post("/api/auth/register").send({ name: "A", email: "dupe@test.com", password: "password123" });
  const res = await request(app).post("/api/auth/register").send({ name: "B", email: "dupe@test.com", password: "password123" });
  assert.strictEqual(res.status, 409);
});

test("core journey: apply, approve, attend, hours update", async () => {
  const volToken = await registerAndLogin("volunteer", "vol2@test.com");
  const coordToken = await registerAndLogin("coordinator", "coord2@test.com");

  const oppRes = await request(app)
    .post("/api/opportunities")
    .set("Authorization", `Bearer ${coordToken}`)
    .send({
      title: "Test Opportunity", description: "desc", category: "Education",
      commitmentType: "ad_hoc", location: "Somewhere",
      startDatetime: "2026-10-01T10:00:00", endDatetime: "2026-10-01T12:00:00",
      capacity: 1,
    });
  assert.strictEqual(oppRes.status, 201);
  const oppId = oppRes.body.id;

  const applyRes = await request(app)
    .post(`/api/opportunities/${oppId}/apply`)
    .set("Authorization", `Bearer ${volToken}`)
    .send({});
  assert.strictEqual(applyRes.status, 201);

  const dupRes = await request(app)
    .post(`/api/opportunities/${oppId}/apply`)
    .set("Authorization", `Bearer ${volToken}`)
    .send({});
  assert.strictEqual(dupRes.status, 409);

  const listRes = await request(app)
    .get(`/api/opportunities/${oppId}/applications`)
    .set("Authorization", `Bearer ${coordToken}`);
  const appId = listRes.body[0].id;

  const approveRes = await request(app)
    .patch(`/api/applications/${appId}`)
    .set("Authorization", `Bearer ${coordToken}`)
    .send({ status: "approved" });
  assert.strictEqual(approveRes.body.status, "approved");

  const scheduleRes = await request(app)
    .get("/api/volunteers/me/schedule")
    .set("Authorization", `Bearer ${volToken}`);
  assert.strictEqual(scheduleRes.body.length, 1);

  const meRes = await request(app)
    .post("/api/auth/login")
    .send({ email: "vol2@test.com", password: "password123" });
  const volunteerId = meRes.body.user.id;

  const attendRes = await request(app)
    .post("/api/attendance")
    .set("Authorization", `Bearer ${coordToken}`)
    .send({ opportunityId: oppId, volunteerId, attended: true, hoursCompleted: 3 });
  assert.strictEqual(attendRes.status, 201);

  const hoursRes = await request(app)
    .get("/api/volunteers/me/hours")
    .set("Authorization", `Bearer ${volToken}`);
  assert.strictEqual(hoursRes.body.totalHours, 3);
});

test("registration rejects an invalid email and a short password", async () => {
  const badEmail = await request(app)
    .post("/api/auth/register")
    .send({ name: "X", email: "not-an-email", password: "password123" });
  assert.strictEqual(badEmail.status, 400);

  const shortPassword = await request(app)
    .post("/api/auth/register")
    .send({ name: "X", email: "ok@test.com", password: "short" });
  assert.strictEqual(shortPassword.status, 400);
});

test("coordinator can export the volunteer-hours report as CSV", async () => {
  const volToken = await registerAndLogin("volunteer", "csvvol@test.com");
  const coordToken = await registerAndLogin("coordinator", "csvcoord@test.com");

  const oppRes = await request(app)
    .post("/api/opportunities")
    .set("Authorization", `Bearer ${coordToken}`)
    .send({
      title: "CSV Test", description: "d", category: "c",
      commitmentType: "ad_hoc", location: "l",
      startDatetime: "2026-10-01T10:00:00", endDatetime: "2026-10-01T12:00:00",
      capacity: 1,
    });
  const oppId = oppRes.body.id;

  const applyRes = await request(app)
    .post(`/api/opportunities/${oppId}/apply`)
    .set("Authorization", `Bearer ${volToken}`)
    .send({});
  await request(app)
    .patch(`/api/applications/${applyRes.body.id}`)
    .set("Authorization", `Bearer ${coordToken}`)
    .send({ status: "approved" });

  const meRes = await request(app).post("/api/auth/login").send({ email: "csvvol@test.com", password: "password123" });
  await request(app)
    .post("/api/attendance")
    .set("Authorization", `Bearer ${coordToken}`)
    .send({ opportunityId: oppId, volunteerId: meRes.body.user.id, attended: true, hoursCompleted: 4 });

  const csvRes = await request(app)
    .get("/api/reports/volunteer-hours/export.csv")
    .set("Authorization", `Bearer ${coordToken}`);
  assert.strictEqual(csvRes.status, 200);
  assert.match(csvRes.headers["content-type"], /text\/csv/);
  assert.match(csvRes.text, /Volunteer Name,Email,Activities Completed,Total Hours/);
  assert.match(csvRes.text, /4/);
});

test("a volunteer cannot access the coordinator report endpoints", async () => {
  const volToken = await registerAndLogin("volunteer", "noaccessvol@test.com");
  const res = await request(app)
    .get("/api/reports/volunteer-hours/export.csv")
    .set("Authorization", `Bearer ${volToken}`);
  assert.strictEqual(res.status, 403);
});

test("BR4: a briefing-required opportunity cannot be approved without confirmation", async () => {
  const volToken = await registerAndLogin("volunteer", "br4vol@test.com");
  const coordToken = await registerAndLogin("coordinator", "br4coord@test.com");

  const oppRes = await request(app)
    .post("/api/opportunities")
    .set("Authorization", `Bearer ${coordToken}`)
    .send({
      title: "Mentoring Needs Briefing", description: "d", category: "c",
      commitmentType: "mentoring", location: "l",
      startDatetime: "2026-10-01T10:00:00", endDatetime: "2026-10-01T12:00:00",
      capacity: 1, requiresBriefing: true,
    });
  const oppId = oppRes.body.id;

  const applyRes = await request(app)
    .post(`/api/opportunities/${oppId}/apply`)
    .set("Authorization", `Bearer ${volToken}`)
    .send({});
  const appId = applyRes.body.id;

  const blockedApproval = await request(app)
    .patch(`/api/applications/${appId}`)
    .set("Authorization", `Bearer ${coordToken}`)
    .send({ status: "approved" });
  assert.strictEqual(blockedApproval.status, 400);

  const confirmedApproval = await request(app)
    .patch(`/api/applications/${appId}`)
    .set("Authorization", `Bearer ${coordToken}`)
    .send({ status: "approved", briefingConfirmed: true });
  assert.strictEqual(confirmedApproval.status, 200);
  assert.strictEqual(confirmedApproval.body.status, "approved");
  assert.strictEqual(confirmedApproval.body.briefingConfirmed, true);
});

test("Zod validation rejects a malformed opportunity payload", async () => {
  const coordToken = await registerAndLogin("coordinator", "zodcoord@test.com");
  const res = await request(app)
    .post("/api/opportunities")
    .set("Authorization", `Bearer ${coordToken}`)
    .send({ title: "", commitmentType: "not_a_real_type", capacity: -5 });
  assert.strictEqual(res.status, 400);
  assert.ok(Array.isArray(res.body.details));
});

test("a volunteer cannot access coordinator-only routes", async () => {
  const volToken = await registerAndLogin("volunteer", "vol3@test.com");
  const res = await request(app)
    .post("/api/opportunities")
    .set("Authorization", `Bearer ${volToken}`)
    .send({});
  assert.strictEqual(res.status, 403);
});

test("application is rejected once capacity is reached", async () => {
  const coordToken = await registerAndLogin("coordinator", "coord3@test.com");
  const vol1Token = await registerAndLogin("volunteer", "vol4@test.com");
  const vol2Token = await registerAndLogin("volunteer", "vol5@test.com");

  const oppRes = await request(app)
    .post("/api/opportunities")
    .set("Authorization", `Bearer ${coordToken}`)
    .send({
      title: "Capacity Test", description: "d", category: "c",
      commitmentType: "ad_hoc", location: "l",
      startDatetime: "2026-10-01T10:00:00", endDatetime: "2026-10-01T12:00:00",
      capacity: 1,
    });
  const oppId = oppRes.body.id;

  const app1 = await request(app).post(`/api/opportunities/${oppId}/apply`).set("Authorization", `Bearer ${vol1Token}`).send({});
  const app2 = await request(app).post(`/api/opportunities/${oppId}/apply`).set("Authorization", `Bearer ${vol2Token}`).send({});

  await request(app).patch(`/api/applications/${app1.body.id}`).set("Authorization", `Bearer ${coordToken}`).send({ status: "approved" });
  const secondApproval = await request(app).patch(`/api/applications/${app2.body.id}`).set("Authorization", `Bearer ${coordToken}`).send({ status: "approved" });

  assert.strictEqual(secondApproval.status, 400);
});

test("admin can list users and filter by role", async () => {
  const admin = createAdmin("Admin One", "adminlist@test.com");
  await registerAndLogin("volunteer", "listvol@test.com");
  await registerAndLogin("coordinator", "listcoord@test.com");

  const all = await request(app).get("/api/admin/users").set("Authorization", `Bearer ${admin.token}`);
  assert.strictEqual(all.status, 200);
  assert.ok(all.body.some((u) => u.email === "listvol@test.com"));
  assert.ok(all.body.every((u) => "ownedCount" in u && "active" in u));

  const coordsOnly = await request(app)
    .get("/api/admin/users?role=coordinator")
    .set("Authorization", `Bearer ${admin.token}`);
  assert.ok(coordsOnly.body.every((u) => u.role === "coordinator"));
});

test("a non-admin cannot list or modify users", async () => {
  const volToken = await registerAndLogin("volunteer", "notadmin@test.com");
  const res = await request(app).get("/api/admin/users").set("Authorization", `Bearer ${volToken}`);
  assert.strictEqual(res.status, 403);
});

test("admin can disable and re-enable a user with no owned opportunities", async () => {
  const admin = createAdmin("Admin Two", "admindisable@test.com");
  const volToken = await registerAndLogin("volunteer", "disableme@test.com");
  const meRes = await request(app).post("/api/auth/login").send({ email: "disableme@test.com", password: "password123" });
  const volId = meRes.body.user.id;
  void volToken;

  const disableRes = await request(app)
    .patch(`/api/admin/users/${volId}`)
    .set("Authorization", `Bearer ${admin.token}`)
    .send({ active: false });
  assert.strictEqual(disableRes.status, 200);
  assert.strictEqual(disableRes.body.active, false);

  const loginBlocked = await request(app).post("/api/auth/login").send({ email: "disableme@test.com", password: "password123" });
  assert.strictEqual(loginBlocked.status, 403);

  const enableRes = await request(app)
    .patch(`/api/admin/users/${volId}`)
    .set("Authorization", `Bearer ${admin.token}`)
    .send({ active: true });
  assert.strictEqual(enableRes.status, 200);
  assert.strictEqual(enableRes.body.active, true);

  const loginRestored = await request(app).post("/api/auth/login").send({ email: "disableme@test.com", password: "password123" });
  assert.strictEqual(loginRestored.status, 200);
});

test("admin cannot disable their own account", async () => {
  const admin = createAdmin("Admin Three", "adminself@test.com");
  const res = await request(app)
    .patch(`/api/admin/users/${admin.id}`)
    .set("Authorization", `Bearer ${admin.token}`)
    .send({ active: false });
  assert.strictEqual(res.status, 400);
});

test("disabling a coordinator with owned opportunities is blocked until ownership is transferred", async () => {
  const admin = createAdmin("Admin Four", "admintransfer@test.com");
  const coordToken = await registerAndLogin("coordinator", "ownercoord@test.com");
  const newOwnerToken = await registerAndLogin("coordinator", "neowner@test.com");
  void newOwnerToken;

  const coordId = jwt.verify(coordToken, JWT_SECRET).id;
  const newOwnerId = jwt.verify(newOwnerToken, JWT_SECRET).id;

  const oppRes = await request(app)
    .post("/api/opportunities")
    .set("Authorization", `Bearer ${coordToken}`)
    .send({
      title: "Owned Opportunity", description: "d", category: "c",
      commitmentType: "ad_hoc", location: "l",
      startDatetime: "2026-10-01T10:00:00", endDatetime: "2026-10-01T12:00:00",
      capacity: 1,
    });
  assert.strictEqual(oppRes.status, 201);

  const blockedDisable = await request(app)
    .patch(`/api/admin/users/${coordId}`)
    .set("Authorization", `Bearer ${admin.token}`)
    .send({ active: false });
  assert.strictEqual(blockedDisable.status, 400);
  assert.strictEqual(blockedDisable.body.ownedCount, 1);

  const transferRes = await request(app)
    .post(`/api/admin/users/${coordId}/transfer-ownership`)
    .set("Authorization", `Bearer ${admin.token}`)
    .send({ newOwnerId });
  assert.strictEqual(transferRes.status, 200);
  assert.strictEqual(transferRes.body.reassigned, 1);

  const nowAllowedDisable = await request(app)
    .patch(`/api/admin/users/${coordId}`)
    .set("Authorization", `Bearer ${admin.token}`)
    .send({ active: false });
  assert.strictEqual(nowAllowedDisable.status, 200);

  const check = await request(app)
    .get(`/api/opportunities/${oppRes.body.id}`)
    .set("Authorization", `Bearer ${admin.token}`);
  assert.strictEqual(check.body.createdBy, newOwnerId);
});

test("ownership transfer rejects a volunteer or disabled account as the new owner", async () => {
  const admin = createAdmin("Admin Five", "adminreject@test.com");
  const coordToken = await registerAndLogin("coordinator", "rejectcoord@test.com");
  const volToken = await registerAndLogin("volunteer", "rejectvol@test.com");
  void volToken;

  const coordId = jwt.verify(coordToken, JWT_SECRET).id;
  const meRes = await request(app).post("/api/auth/login").send({ email: "rejectvol@test.com", password: "password123" });
  const volId = meRes.body.user.id;

  const oppRes = await request(app)
    .post("/api/opportunities")
    .set("Authorization", `Bearer ${coordToken}`)
    .send({
      title: "Reject Test", description: "d", category: "c",
      commitmentType: "ad_hoc", location: "l",
      startDatetime: "2026-10-01T10:00:00", endDatetime: "2026-10-01T12:00:00",
      capacity: 1,
    });
  assert.strictEqual(oppRes.status, 201);

  const toVolunteer = await request(app)
    .post(`/api/admin/users/${coordId}/transfer-ownership`)
    .set("Authorization", `Bearer ${admin.token}`)
    .send({ newOwnerId: volId });
  assert.strictEqual(toVolunteer.status, 400);

  const disabledCoordToken = await registerAndLogin("coordinator", "disabledtarget@test.com");
  const disabledCoordId = jwt.verify(disabledCoordToken, JWT_SECRET).id;
  await request(app)
    .patch(`/api/admin/users/${disabledCoordId}`)
    .set("Authorization", `Bearer ${admin.token}`)
    .send({ active: false });

  const toDisabled = await request(app)
    .post(`/api/admin/users/${coordId}/transfer-ownership`)
    .set("Authorization", `Bearer ${admin.token}`)
    .send({ newOwnerId: disabledCoordId });
  assert.strictEqual(toDisabled.status, 400);
});

test("concurrent approvals for the same capacity-1 opportunity never both succeed", async () => {
  const coordToken = await registerAndLogin("coordinator", "raceoord@test.com");
  const vol1Token = await registerAndLogin("volunteer", "racevol1@test.com");
  const vol2Token = await registerAndLogin("volunteer", "racevol2@test.com");

  const oppRes = await request(app)
    .post("/api/opportunities")
    .set("Authorization", `Bearer ${coordToken}`)
    .send({
      title: "Race Condition Test", description: "d", category: "c",
      commitmentType: "ad_hoc", location: "l",
      startDatetime: "2026-10-01T10:00:00", endDatetime: "2026-10-01T12:00:00",
      capacity: 1,
    });
  const oppId = oppRes.body.id;

  const app1 = await request(app).post(`/api/opportunities/${oppId}/apply`).set("Authorization", `Bearer ${vol1Token}`).send({});
  const app2 = await request(app).post(`/api/opportunities/${oppId}/apply`).set("Authorization", `Bearer ${vol2Token}`).send({});

  // Fire both approvals concurrently (Promise.all, not awaited one at a time) —
  // this is the scenario the capacity check + update transaction guards against.
  const [res1, res2] = await Promise.all([
    request(app).patch(`/api/applications/${app1.body.id}`).set("Authorization", `Bearer ${coordToken}`).send({ status: "approved" }),
    request(app).patch(`/api/applications/${app2.body.id}`).set("Authorization", `Bearer ${coordToken}`).send({ status: "approved" }),
  ]);

  const statuses = [res1.status, res2.status].sort();
  assert.deepStrictEqual(statuses, [200, 400], "exactly one approval should succeed and one should be rejected for capacity");

  const listRes = await request(app)
    .get(`/api/opportunities/${oppId}/applications`)
    .set("Authorization", `Bearer ${coordToken}`);
  const approvedCount = listRes.body.filter((a) => a.status === "approved").length;
  assert.strictEqual(approvedCount, 1, "the opportunity must never end up over capacity");
});

test("login sets an httpOnly auth cookie", async () => {
  const email = "cookieuser1@test.com";
  await request(app)
    .post("/api/auth/register")
    .send({ name: "Cookie User", email, password: "password123", role: "volunteer" });

  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password: "password123" });

  const setCookie = res.headers["set-cookie"];
  assert.ok(setCookie, "login response should set a cookie");
  const tokenCookie = setCookie.find((c) => c.startsWith("token="));
  assert.ok(tokenCookie, "the cookie should be named 'token'");
  assert.match(tokenCookie, /HttpOnly/i, "the auth cookie must be HttpOnly so page JS can't read it");
});

test("a protected route accepts the auth cookie alone, with no Authorization header", async () => {
  const email = "cookieuser2@test.com";
  const agent = request.agent(app); // supertest's cookie-jar-aware client

  await agent
    .post("/api/auth/register")
    .send({ name: "Cookie User 2", email, password: "password123", role: "volunteer" });

  // The agent now holds the cookie from the register response; this request
  // deliberately sets no Authorization header at all.
  const res = await agent.get("/api/volunteers/me/profile");
  assert.strictEqual(res.status, 200, "the cookie alone should be enough to authenticate");
});

test("logout clears the auth cookie", async () => {
  const email = "cookieuser3@test.com";
  const agent = request.agent(app);

  await agent
    .post("/api/auth/register")
    .send({ name: "Cookie User 3", email, password: "password123", role: "volunteer" });

  const logoutRes = await agent.post("/api/auth/logout");
  assert.strictEqual(logoutRes.status, 200);

  const profileRes = await agent.get("/api/volunteers/me/profile");
  assert.strictEqual(profileRes.status, 401, "after logout, the cleared cookie must no longer authenticate");
});

test("CORS response is safe for credentialed cross-origin requests (no wildcard + credentials)", async () => {
  // This is a regression test for a real bug shipped once: enabling
  // `credentials: true` without a concrete `origin` makes the `cors` package
  // default to the wildcard "*", which every browser then refuses to accept
  // for a credentialed request (the httpOnly-cookie auth flow) — the request
  // fails client-side with a CORS error even though the server responds 200.
  const res = await request(app)
    .get("/api/health")
    .set("Origin", "https://example-client.test");

  assert.strictEqual(
    res.headers["access-control-allow-origin"],
    "https://example-client.test",
    "must reflect the specific request origin, never '*', once credentials are enabled"
  );
  assert.strictEqual(res.headers["access-control-allow-credentials"], "true");
});
