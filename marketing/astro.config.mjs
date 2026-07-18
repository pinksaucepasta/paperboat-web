// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
    // Ensure a single React instance so libraries like
    // @paper-design/shaders-react share the app's React (avoids
    // "Invalid hook call" from duplicate React copies).
    resolve: {
      dedupe: ["react", "react-dom"],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "@paper-design/shaders-react",
      ],
    },
  },

  integrations: [react()],
});