/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'shared/**/*.js',
    'services/*/src/**/*.js',
    '!**/node_modules/**',
  ],
  coverageDirectory: 'coverage',
  testTimeout: 30000,
};
