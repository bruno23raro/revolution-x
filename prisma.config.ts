import { defineConfig } from '@prisma/config';

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL ?? '',
    directUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '',
    schemas: ['public', 'auth'],
  },
  prisma: {
    // Additional Prisma config if needed
  },
});
