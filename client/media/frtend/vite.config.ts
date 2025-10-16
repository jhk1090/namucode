import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
    extensions: [".js", ".vue"]
  },
  plugins: [vue()],
  build: {
    lib: {
      entry: "src/main.js",
      name: "test"
    },
    outDir: "../../out/client",
    minify: "esbuild"
  },
  define: {
    "process.env": {}
  }
});
