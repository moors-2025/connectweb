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
