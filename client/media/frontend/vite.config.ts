import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
    resolve: {
        alias: {
            "@": resolve(__dirname, "src"),
        },
        extensions: [".js", ".vue"],
    },
    plugins: [
        vue(),
        viteStaticCopy({
            targets: [
                {
                    src: "src/assets",
                    dest: "../../out/client",
                },
            ],
        }),
    ],
    build: {
        lib: { entry: "src/main.js", name: "test", formats: ["es"] },
        outDir: "../../out/client",
        cssCodeSplit: false,
        rollupOptions: {
            output: {
                assetFileNames: "assets/[name][extname]"
            },
            plugins: [
              {
                name: 'remove-css-bundle',
                generateBundle(_, bundle) {
                  // 혹시 남아 있는 .css 파일 제거
                  for (const file in bundle) {
                    if (file.endsWith('.css')) {
                      delete bundle[file]
                    }
                  }
                }
              }
            ]
        },
    },
    define: {
        "process.env": {},
    },
});
