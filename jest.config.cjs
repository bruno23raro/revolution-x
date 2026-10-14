module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@/lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@/api/(.*)$': '<rootDir>/app/api/$1',
    '^@/integrations/(.*)$': '<rootDir>/src/integrations/$1',
    '^@/services/(.*)$': '<rootDir>/src/services/$1',
    '^@/repositories/(.*)$': '<rootDir>/src/repositories/$1',
  },
};
