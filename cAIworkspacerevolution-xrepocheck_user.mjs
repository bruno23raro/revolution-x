import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.findUnique({ where: { email: "admin@revolutionx.dev" } });
  console.log("User found:", !!user);
  if (user) {
    console.log("ID:", user.id);
    console.log("Email:", user.email);
    console.log("Password hash:", user.passwordHash);
  }
}
main().catch(e => console.error("Error:", e.message)).finally(() => prisma.$disconnect());
