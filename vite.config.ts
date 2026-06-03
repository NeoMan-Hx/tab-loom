/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react(), chromeExtensionHtmlPlugin()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        entryFileNames: "app.js",
        chunkFileNames: "chunk-[name].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.names.some((name) => name.endsWith(".css"))) {
            return "style.css";
          }

          return "[name][extname]";
        }
      }
    }
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"]
  }
});

function chromeExtensionHtmlPlugin(): Plugin {
  return {
    name: "chrome-extension-html",
    enforce: "post",
    generateBundle(_, bundle) {
      const html = bundle["index.html"];
      if (!html || html.type !== "asset" || typeof html.source !== "string") return;

      html.source = html.source
        .replace(/<script type="module" crossorigin src="\.\/app\.js"><\/script>/, '<script defer src="app.js"></script>')
        .replace(/<script type="module" crossorigin src="\/app\.js"><\/script>/, '<script defer src="app.js"></script>')
        .replace(/<link rel="stylesheet" crossorigin href="\.\/style\.css">/, '<link rel="stylesheet" href="style.css">')
        .replace(/<link rel="stylesheet" crossorigin href="\/style\.css">/, '<link rel="stylesheet" href="style.css">');
    }
  };
}
