const bcrypt = require("bcryptjs");
const { prisma } = require("./prisma-client");

async function upsertUser({ name, email, password, role }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  return prisma.user.create({
    data: {
      name,
      email,
      passwordHash: bcrypt.hashSync(password, 10),
      role,
      ...(role === "volunteer" ? { profile: { create: {} } } : {}),
    },
  });
}

async function main() {
  const mei = await upsertUser({ name: "Mei", email: "mei@example.com", password: "password123", role: "volunteer" });
  const ali = await upsertUser({ name: "Mr Ali", email: "ali@example.com", password: "password123", role: "coordinator" });

  const existingOpp = await prisma.opportunity.findFirst({ where: { title: "Youth Learning Support" } });
  if (!existingOpp) {
    await prisma.opportunity.create({
      data: {
        title: "Youth Learning Support",
        description: "Support young people through structured learning and confidence-building activities.",
        category: "Education Project",
        commitmentType: "recurring",
        location: "PERTAPIS programme site",
        startDatetime: new Date("2026-09-20T10:00:00"),
        endDatetime: new Date("2026-09-20T12:00:00"),
        capacity: 4,
        requiresBriefing: true,
        createdBy: ali.id,
      },
    });

    await prisma.opportunity.create({
      data: {
        title: "Flag Day Fundraiser",
        description: "Help with registration and logistics for the annual Flag Day fundraising drive.",
        category: "Events and Fundraising",
        commitmentType: "ad_hoc",
        location: "Community site",
        startDatetime: new Date("2026-10-04T08:00:00"),
        endDatetime: new Date("2026-10-04T13:00:00"),
        capacity: 10,
        requiresBriefing: false,
        createdBy: ali.id,
      },
    });

    await prisma.opportunity.create({
      data: {
        title: "Senior Befriending Visits",
        description: "Regular conversations and social activities with seniors at a welfare home.",
        category: "Senior Befriending",
        commitmentType: "recurring",
        location: "Welfare home",
        startDatetime: new Date("2026-09-27T14:00:00"),
        endDatetime: new Date("2026-09-27T16:00:00"),
        capacity: 6,
        requiresBriefing: true,
        createdBy: ali.id,
      },
    });
  }

  console.log("Seed complete (PostgreSQL).");
  console.log("Volunteer login: mei@example.com / password123");
  console.log("Coordinator login: ali@example.com / password123");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
