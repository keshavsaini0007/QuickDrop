/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/lib/**/*.ts',
    'src/store/**/*.ts',
    '!src/lib/uploadQueue.ts',
    '!src/lib/offline.ts',
    '!src/lib/notifications.ts',
    '!src/lib/biometrics.ts',
    '!src/lib/pickers.ts',
  ],
  coverageDirectory: 'coverage',
  clearMocks: true,
};
