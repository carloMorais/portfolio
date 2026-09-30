import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: "jsdom",
  coverageProvider: "v8",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testPathIgnorePatterns: ["<rootDir>/e2e/", "<rootDir>/.next/"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
};

// next-intl and use-intl ship ESM only, so they must go through the transform.
const jestConfig = async () => {
  const resolved = await createJestConfig(config)();
  return {
    ...resolved,
    transformIgnorePatterns: [
      "/node_modules/(?!(next-intl|use-intl|@formatjs|intl-messageformat)/)",
    ],
  };
};

export default jestConfig;
