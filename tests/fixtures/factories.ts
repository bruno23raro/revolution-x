import { faker } from "@faker-js/faker";
export const tenant = (o = {}) => ({ id: faker.string.uuid(), slug: faker.string.alphanumeric(10), name: faker.company.name(), ...o });
export const user = (o = {}) => ({ id: faker.string.uuid(), email: faker.internet.email().toLowerCase(), passwordHash: "$2a$12$abcdefghijklmnopqrstuv", tenantId: faker.string.uuid(), role: "member", ...o });
export const session = (o = {}) => ({ token: faker.string.alphanumeric(48), userId: faker.string.uuid(), expiresAt: new Date(Date.now() + 9e5), ...o });
