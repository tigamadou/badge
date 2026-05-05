import { PrismaClient, Role } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || "admin@investiture.local";
  const password = process.env.SEED_ADMIN_PASSWORD || "admin123";

  const existingAdmin = await prisma.user.findUnique({ where: { email } });
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        email,
        password: await hash(password, 12),
        name: "Super Admin",
        role: Role.SUPER_ADMIN,
      },
    });
    console.log(`Super admin created: ${email}`);
  }

  const teams = [
    { name: "Sécurité", color: "#DC2626" },
    { name: "Protocole", color: "#2563EB" },
    { name: "Presse", color: "#16A34A" },
  ];
  for (const team of teams) {
    const existing = await prisma.team.findFirst({ where: { name: team.name } });
    if (!existing) {
      await prisma.team.create({ data: team });
      console.log(`Team created: ${team.name}`);
    }
  }

  const existingEvent = await prisma.event.findFirst();
  if (!existingEvent) {
    await prisma.event.create({
      data: {
        title: "Cérémonie d'investiture du Président de la République",
        location: "Porto-Novo",
        date: "2026-05-24",
      },
    });
    console.log("Default event created");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
