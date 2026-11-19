import "@testing-library/jest-dom";
process.env.NODE_ENV = "test";
process.env.CRON_SECRET ??= "test-cron-secret";
process.env.JWT_SECRET ??= "test-jwt-secret-32-chars-minimum";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-32-chars-minimum";