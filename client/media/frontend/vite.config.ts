import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";
// import { viteStaticCopy } from "vite-plugin-static-copy";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";
// import { viteSingleFile } from "vite-plugin-singlefile"

export default defineConfig({
    resolve: {
        alias: {
            "@": resolve(__dirname, "src"),
        },
        extensions: [".js", ".vue"],
    },
    plugins: [
        vue(),
        // viteSingleFile()
        cssInjectedByJsPlugin(),
        // viteStaticCopy({
        //     targets: [
        //         {
        //             src: "src/assets",
        //             dest: ".",
        //         },
        //     ],
        // }),
    ],
    css: {
        modules: {
            generateScopedName: '[name]__[local]___[hash:base64:5]'
        }
    },
    assetsInclude: ['**/*.woff', '**/*.woff2', '**/*.ttf', '**/*.otf', '**/*.eot'],
    build: {
        lib: { entry: "src/main.js", name: "test", formats: ["es"] },
        outDir: "dist",
        cssCodeSplit: false,
        assetsInlineLimit: 100000000,
        rollupOptions: {
            output: {
                inlineDynamicImports: true,
                entryFileNames: 'assets/[name].js',
                chunkFileNames: 'assets/[name].js',
                assetFileNames: 'assets/[name].[ext]'
            }
            // output: {
            //     assetFileNames: "assets/[name][extname]"
            // },
            // plugins: [
            //   {
            //     name: 'remove-css-bundle',
            //     generateBundle(_, bundle) {
            //       // 혹시 남아 있는 .css 파일 제거
            //       for (const file in bundle) {
            //         if (file.endsWith('.css')) {
            //           delete bundle[file]
            //         }
            //       }
            //     }
            //   }
            // ]
        },
    },
    define: {
        "process.env": {},
    },
});
