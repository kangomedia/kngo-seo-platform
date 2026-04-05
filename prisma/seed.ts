import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ─── Admin User ──────────────────────────────────────
  const hashedPassword = await bcrypt.hash("admin123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "freddy@kangomedia.com" },
    update: {},
    create: {
      email: "freddy@kangomedia.com",
      name: "Freddy R.",
      hashedPassword,
      role: "AGENCY_ADMIN",
    },
  });

  console.log(`  ✅ Admin user: ${admin.email}`);

  // ─── Demo Client User ───────────────────────────────
  const clientPassword = await bcrypt.hash("client123", 12);

  const clientUser = await prisma.user.upsert({
    where: { email: "demo@missionacheating.com" },
    update: {},
    create: {
      email: "demo@missionacheating.com",
      name: "Demo Client",
      hashedPassword: clientPassword,
      role: "CLIENT",
    },
  });

  console.log(`  ✅ Client user: ${clientUser.email}`);

  // ─── Clients ─────────────────────────────────────────
  const missionAc = await prisma.client.upsert({
    where: { id: "cl-mission-ac" },
    update: {},
    create: {
      id: "cl-mission-ac",
      name: "Mission AC & Heating",
      domain: "missionacheating.com",
      tier: "GROWTH",
      monthlyBlogs: 4,
      monthlyGbpPosts: 8,
      monthlyPressReleases: 1,
    },
  });

  const strongContractors = await prisma.client.upsert({
    where: { id: "cl-strong-contractors" },
    update: {},
    create: {
      id: "cl-strong-contractors",
      name: "Strong Contractors",
      domain: "strongcontractors.com",
      tier: "PRO",
      monthlyBlogs: 6,
      monthlyGbpPosts: 12,
      monthlyPressReleases: 1,
    },
  });

  const eclypse = await prisma.client.upsert({
    where: { id: "cl-eclypse-auto" },
    update: {},
    create: {
      id: "cl-eclypse-auto",
      name: "Eclypse Auto",
      domain: "eclypseauto.com",
      tier: "STARTER",
      monthlyBlogs: 2,
      monthlyGbpPosts: 4,
      monthlyPressReleases: 0,
    },
  });

  const lxConstruction = await prisma.client.upsert({
    where: { id: "cl-lx-construction" },
    update: {},
    create: {
      id: "cl-lx-construction",
      name: "LX Construction",
      domain: "lxconstructionllc.com",
      tier: "STARTER",
      monthlyBlogs: 2,
      monthlyGbpPosts: 4,
      monthlyPressReleases: 0,
    },
  });

  console.log(`  ✅ Clients: ${[missionAc, strongContractors, eclypse, lxConstruction].map((c) => c.name).join(", ")}`);
  console.log(`\n  📎 Client Portal Links:`);
  console.log(`     ${missionAc.name}: /client/${missionAc.accessToken}`);
  console.log(`     ${strongContractors.name}: /client/${strongContractors.accessToken}`);
  console.log(`     ${eclypse.name}: /client/${eclypse.accessToken}`);
  console.log(`     ${lxConstruction.name}: /client/${lxConstruction.accessToken}`);

  // ─── Link client user to Mission AC ──────────────────
  await prisma.clientUser.upsert({
    where: {
      userId_clientId: {
        userId: clientUser.id,
        clientId: missionAc.id,
      },
    },
    update: {},
    create: {
      userId: clientUser.id,
      clientId: missionAc.id,
    },
  });

  console.log(`  ✅ Linked ${clientUser.email} → ${missionAc.name}`);

  // ─── Keywords for Mission AC ─────────────────────────
  const keywords = [
    { keyword: "ac repair denver", searchVolume: 2400, difficulty: 42 },
    { keyword: "furnace repair denver", searchVolume: 1900, difficulty: 38 },
    { keyword: "hvac company near me", searchVolume: 4800, difficulty: 55 },
    { keyword: "heating installation denver", searchVolume: 880, difficulty: 35 },
    { keyword: "emergency ac repair", searchVolume: 1200, difficulty: 30 },
    { keyword: "ac tune up denver", searchVolume: 720, difficulty: 25 },
    { keyword: "furnace installation cost", searchVolume: 1600, difficulty: 40 },
    { keyword: "best hvac company denver", searchVolume: 390, difficulty: 48 },
  ];

  for (const kw of keywords) {
    await prisma.keyword.upsert({
      where: {
        clientId_keyword: {
          clientId: missionAc.id,
          keyword: kw.keyword,
        },
      },
      update: {},
      create: {
        clientId: missionAc.id,
        keyword: kw.keyword,
        searchVolume: kw.searchVolume,
        difficulty: kw.difficulty,
      },
    });
  }

  console.log(`  ✅ Keywords: ${keywords.length} seeded for Mission AC`);

  // ─── Content Plan for Mission AC ─────────────────────
  const plan = await prisma.contentPlan.upsert({
    where: {
      clientId_month_year: {
        clientId: missionAc.id,
        month: 4,
        year: 2026,
      },
    },
    update: {},
    create: {
      clientId: missionAc.id,
      month: 4,
      year: 2026,
      title: "April 2026 Content Plan",
      seedKeyword: "ac repair denver",
    },
  });

  const pieces = [
    {
      type: "BLOG_POST" as const,
      title: "5 Signs Your AC Needs Repair Before Summer",
      description: "Seasonal awareness — catches early-intent searches from homeowners prepping for Denver summer.",
      keyword: "ac repair denver",
      status: "APPROVED" as const,
    },
    {
      type: "BLOG_POST" as const,
      title: "Furnace vs. Heat Pump: Which is Best for Denver Homes?",
      description: "Comparison guide targeting high-volume keyword cluster around HVAC decision-making.",
      keyword: "furnace repair denver",
      status: "CLIENT_REVIEW" as const,
    },
    {
      type: "GBP_POST" as const,
      title: "Spring AC Tune-Up Special — $89",
      description: "Promotion post for Google Business Profile to drive local visibility.",
      keyword: "ac tune up denver",
      status: "PUBLISHED" as const,
    },
    {
      type: "GBP_POST" as const,
      title: "Why Denver Homeowners Trust Mission AC",
      description: "Social proof post highlighting 5-star reviews and years of experience.",
      keyword: "best hvac company denver",
      status: "CLIENT_REVIEW" as const,
    },
  ];

  for (let i = 0; i < pieces.length; i++) {
    await prisma.contentPiece.create({
      data: {
        contentPlanId: plan.id,
        type: pieces[i].type,
        title: pieces[i].title,
        description: pieces[i].description,
        keyword: pieces[i].keyword,
        status: pieces[i].status,
        sortOrder: i,
      },
    });
  }

  console.log(`  ✅ Content plan: ${pieces.length} pieces for April 2026`);

  // ─── Deliverables for Mission AC ─────────────────────
  const deliverables = [
    { name: "Blog Posts", targetCount: 4, currentCount: 1, status: "IN_PROGRESS" as const },
    { name: "GBP Posts", targetCount: 8, currentCount: 3, status: "IN_PROGRESS" as const },
    { name: "Press Releases", targetCount: 1, currentCount: 0, status: "PENDING" as const },
    { name: "Rank Tracking", targetCount: 1, currentCount: 1, status: "COMPLETED" as const },
    { name: "Technical Audit Review", targetCount: 1, currentCount: 0, status: "PENDING" as const },
    { name: "Monthly Report", targetCount: 1, currentCount: 0, status: "PENDING" as const },
  ];

  for (const del of deliverables) {
    await prisma.deliverable.create({
      data: {
        clientId: missionAc.id,
        month: 4,
        year: 2026,
        name: del.name,
        targetCount: del.targetCount,
        currentCount: del.currentCount,
        status: del.status,
      },
    });
  }

  console.log(`  ✅ Deliverables: ${deliverables.length} for Mission AC`);

  // ─── Agency Settings ─────────────────────────────────
  await prisma.agencySettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      agencyName: "KangoMedia",
      logoUrl: "/brand/logo-white.svg",
    },
  });

  console.log(`  ✅ Agency settings initialized`);

  console.log("\n🎉 Seeding complete!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
