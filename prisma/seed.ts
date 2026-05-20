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

  const defaultUsers = [
    { email: "admin@investiture.local", name: "Administrateur", role: Role.ADMIN, password: "admin123" },
    { email: "moderateur@investiture.local", name: "Moderateur", role: Role.MODERATEUR, password: "modo123" },
    { email: "operateur@investiture.local", name: "Operateur", role: Role.OPERATOR, password: "oper123" },
  ];
  for (const user of defaultUsers) {
    const existing = await prisma.user.findUnique({ where: { email: user.email } });
    if (!existing) {
      await prisma.user.create({
        data: {
          email: user.email,
          password: await hash(user.password, 12),
          name: user.name,
          role: user.role,
        },
      });
      console.log(`${user.role} created: ${user.email}`);
    }
  }

  const teams = [
    { name: "Sécurité", color: "#DC2626", number: 1 },
    { name: "Protocole", color: "#2563EB", number: 2 },
    { name: "Presse", color: "#16A34A", number: 3 },
  ];
  for (const team of teams) {
    const existing = await prisma.team.findFirst({ where: { OR: [{ name: team.name }, { number: team.number }] } });
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
        date: new Date("2026-05-24"),
      },
    });
    console.log("Default event created");
  }

  const existingSettings = await prisma.settings.findFirst();
  if (!existingSettings) {
    const useEnvSmtp = !!(process.env.SMTP_HOST && process.env.SMTP_HOST !== "mailpit");
    await prisma.settings.create({
      data: {
        smtpHost: process.env.SMTP_HOST || "mailpit",
        smtpPort: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 1025,
        smtpFrom: process.env.SMTP_FROM || "noreply@investiture.local",
        smtpUser: process.env.SMTP_USER || "",
        smtpPassword: process.env.SMTP_PASSWORD || "",
        smtpSecure: useEnvSmtp,
        contactEmail: "contact@investiture.local",
        contactPhone: "+229 97 00 00 00",
      },
    });
    console.log(useEnvSmtp
      ? `Settings created with env SMTP (${process.env.SMTP_HOST})`
      : "Default settings created (Mailpit SMTP)");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
