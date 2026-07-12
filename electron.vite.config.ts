import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, "electron/main/index.ts") },
        external: ["esbuild", "postcss"],
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, "electron/preload/index.ts") },
      },
    },
  },
  renderer: {
    publicDir: resolve(__dirname, "public"),
    resolve: { alias: { "@": resolve(__dirname, "src") } },
    plugins: [react()],
    server: {
      port: 14200,
      strictPort: true,
    },
    css: {
      postcss: resolve(__dirname, "postcss.config.mjs"),
    },
    build: {
      rollupOptions: {
        input: resolve(__dirname, "src/renderer/index.html"),
      },
    },
  },
});
