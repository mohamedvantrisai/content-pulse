import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.test.json',
        diagnostics: { ignoreCodes: [151002] },
      },
    ],
  },
  globalSetup: '<rootDir>/src/test/global-setup.ts',
  globalTeardown: '<rootDir>/src/test/global-teardown.ts',
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  coverageProvider: 'v8',
  coverageDirectory: '<rootDir>/coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/test/**',
    '!src/server.ts',
    '!src/scripts/**',
  ],
};

export default config;
