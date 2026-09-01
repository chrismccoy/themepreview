import { defineConfig, configDefaults } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: ["test/**/*.test.js"],
          exclude: [...configDefaults.exclude, "test/**/*.dom.test.js"],
        },
      },
      {
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["test/**/*.dom.test.js"],
        },
      },
    ],
  },
});
