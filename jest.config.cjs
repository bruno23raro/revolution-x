/** @type {import("jest").Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests/unit", "<rootDir>/tests/regression"],
  moduleNameMapper: {
    "^@/(.*)$": ["<rootDir>/src/$1", "<rootDir>/lib/$1", "<rootDir>/$1"]
  },
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  collectCoverageFrom: ["lib/**/*.ts", "src/**/*.ts", "!**/*.d.ts"],
  coverageThreshold: { global: { lines: 70, branches: 60 } },
  clearMocks: true,
};