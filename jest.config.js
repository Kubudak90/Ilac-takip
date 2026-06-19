// Saf-mantık birim testleri (date / status / adherence / barcode).
// RN/Expo native bağımlılığı olmayan modüller; ts-jest ile node ortamında.
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: { module: 'commonjs', esModuleInterop: true, skipLibCheck: true },
      },
    ],
  },
};
