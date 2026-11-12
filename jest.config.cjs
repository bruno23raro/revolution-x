module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.setup.js'],
  roots: ['<rootDir>/src', '<rootDir>/app'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@/lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@/api/(.*)$': '<rootDir>/app/api/$1',
    '^@/integrations/(.*)$': '<rootDir>/src/integrations/$1',
    '^@/services/(.*)$': '<rootDir>/src/services/$1',
    '^@/repositories/(.*)$': '<rootDir>/src/repositories/$1',
    '^@/jobs/(.*)$': '<rootDir>/src/jobs/$1',
    '^@/middleware/(.*)$': '<rootDir>/src/middleware/$1',
    '^@/middleware$': '<rootDir>/src/middleware/index',
    '^@/ai$': '<rootDir>/src/ai/index',
    '^@/ai/(.*)$': '<rootDir>/src/ai/$1',
  },
};
