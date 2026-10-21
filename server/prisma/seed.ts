import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

// Same rules as BCRYPT_COST in src/config.ts (default 12, integer 4-15, at least 10 in production),
// so seeded hashes cost the same as registered ones. Kept separate because config.ts also requires JWT_SECRET.
function readBcryptCost(): number {
  const raw = process.env.BCRYPT_COST;
  const cost = raw === undefined ? 12 : Number(raw);
  const min = process.env.NODE_ENV === "production" ? 10 : 4;
  if (!Number.isInteger(cost) || cost < min || cost > 15) {
    throw new Error(`BCRYPT_COST must be an integer from ${min} to 15, got "${raw}"`);
  }
  return cost;
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: requireEnv("DATABASE_URL") }),
});

const TABLES = [
  { name: "T1", capacity: 2 },
  { name: "T2", capacity: 2 },
  { name: "T3", capacity: 4 },
  { name: "T4", capacity: 4 },
  { name: "T5", capacity: 6 },
];

async function main(): Promise<void> {
  const cost = readBcryptCost();
  const adminHash = await bcrypt.hash(requireEnv("SEED_ADMIN_PASSWORD"), cost);
  const userHash = await bcrypt.hash(requireEnv("SEED_USER_PASSWORD"), cost);

  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: { email: "admin@example.com", name: "Admin", role: "ADMIN", passwordHash: adminHash },
  });
  await prisma.user.upsert({
    where: { email: "user@example.com" },
    update: {},
    create: { email: "user@example.com", name: "Regular User", role: "USER", passwordHash: userHash },
  });

  for (const t of TABLES) {
    await prisma.table.upsert({
      where: { name: t.name },
      update: {},
      create: t,
    });
  }
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
