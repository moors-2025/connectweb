process.env.DB_PATH = ":memory:";
process.env.JWT_SECRET = "test-secret";

const test = require("node:test");
const assert = require("node:assert");
const request = require("supertest");
const app = require("../src/index");

async function registerAndLogin(role, email) {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ name: role, email, password: "password123", role });
  return res.body.token;
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
