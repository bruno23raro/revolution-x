const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.findUnique({ where: { email: 'brunoalmeida23111996@gmail.com' } })
  .then(u => console.log(u))
  .catch(e => console.error(e.message))
  .finally(() => prisma.$disconnect());