const esbuild = require('esbuild');
const fs = require('fs-extra');
const path = require('path');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const serverExceptionModules = [
  'vscode-css-languageservice',
  'vscode-html-languageservice',
  '@vscode/l10n',
  'vscode-languageserver-types',
  'vscode-uri',
  'web-tree-sitter',
  '@jitl/quickjs-ffi-types',
  '@jitl/quickjs-wasmfile-debug-asyncify',
  '@jitl/quickjs-wasmfile-debug-sync',
  '@jitl/quickjs-wasmfile-release-asyncify',
  '@jitl/quickjs-wasmfile-release-sync',
  'quickjs-emscripten',
  'quickjs-emscripten-core'
]

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: 'esbuild-problem-matcher',
  setup(build) {
    build.onStart(() => {
      const date = new Date();
      const dateFormat = new Intl.DateTimeFormat("ko-KR", { hour: "numeric",
    minute: "numeric",
    second: "numeric", }).format(date);
      console.log(`[${dateFormat}][watch] build started → ${build.initialOptions.outfile}`);
    });
    build.onEnd(result => {
      const date = new Date();
      const dateFormat = new Intl.DateTimeFormat("ko-KR", { hour: "numeric",
    minute: "numeric",
    second: "numeric", }).format(date);
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        if (location == null) return;
        console.error(`    ${location.file}:${location.line}:${location.column}:`);
      });
      console.log(`[${dateFormat}][watch] build finished → ${build.initialOptions.outfile}`);
    });
  }
};

/**
 * 공통 빌드 함수
 */
async function buildProject(entry, outfile, extraOptions = {}) {
  const ctx = await esbuild.context({
      entryPoints: [entry],
      bundle: true,
      format: "cjs",
      minify: production,
      sourcemap: !production,
      sourcesContent: false,
      platform: "node",
      outfile,
      external: ["vscode", ...(extraOptions.external || []), ...serverExceptionModules],
      logLevel: "warning",
      plugins: [esbuildProblemMatcherPlugin]
  });

  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

/**
 * dist/parser/utils, dist/parser/syntax 폴더 복사
 */
function copyParserAssets() {
  const srcParserDir = path.resolve(__dirname, 'server/media/parser/core');
  const distParserDir = path.resolve(__dirname, 'dist/parser');
  const foldersToCopy = ['utils', 'syntax'];

  foldersToCopy.forEach(folder => {
    const srcFolder = path.join(srcParserDir, folder);
    const destFolder = path.join(distParserDir, folder);

    try {
      fs.copySync(srcFolder, destFolder, { overwrite: true });
      console.log(`✅ Copied ${srcFolder} → ${destFolder}`);
    } catch (err) {
      console.error(`❌ Failed to copy ${srcFolder}:`, err);
    }
  });
}

const serverNodeModulesDir = path.resolve(__dirname, 'server/node_modules');
const distNodeModulesDir = path.resolve(__dirname, 'dist/node_modules');

async function copyServerExceptionModules() {
  for (const pkg of serverExceptionModules) {
    const src = path.join(serverNodeModulesDir, pkg);
    const dest = path.join(distNodeModulesDir, pkg);

    try {
      await fs.copy(src, dest, { overwrite: true });
      console.log(`✅ Copied ${pkg} to dist`);
    } catch (err) {
      console.error(`❌ Failed to copy ${pkg}:`, err);
    }
  }
}

// 복사할 파일 목록
const clientMediaFiles = [
  'script.js',
  'reset.css',
];

// 원본 경로
const clientMediaDir = path.resolve(__dirname, 'client/media');
// 복사 대상 경로
const destDir = path.resolve(__dirname, 'dist/media');

async function copyMedia() {
  try {
    // dist/media 폴더 생성
    await fs.ensureDir(destDir);

    for (const file of clientMediaFiles) {
      const src = path.join(clientMediaDir, file);
      const dest = path.join(destDir, file);

      await fs.copy(src, dest, { overwrite: true });
      console.log(`✅ Copied ${file} to dist/media`);
    }

    await fs.copy(
      path.join(path.resolve(__dirname, "server/media/tree-sitter-namumark"), "tree-sitter-namumark.wasm"),
      path.join(destDir, "tree-sitter-namumark.wasm"),
      { overwrite: true }
    )
    console.log(`✅ Copied tree-sitter-namumark.wasm to dist/media`);
  } catch (err) {
    console.error('❌ Failed to copy media files:', err);
  }
}

async function copyFrontendDist() {
  const srcDir = path.resolve(__dirname, 'client/media/frontend/dist');
  const destDir = path.resolve(__dirname, 'dist/frontend');

  try {
    await fs.ensureDir(destDir);
    await fs.copy(srcDir, destDir, { overwrite: true });
    console.log(`✅ Copied all files from ${srcDir} to ${destDir}`);
  } catch (err) {
    console.error('❌ Failed to copy frontend dist:', err);
  }
}

async function main() {
  // Client (VSCode extension)
  await buildProject('client/src/extension.ts', 'dist/extension.js');

  // Server (Language Server)
  await buildProject('server/src/server.ts', 'dist/server.js');

  // Parser Workers & Core
  // await buildProject('client/media/parser/core/parser.js', 'dist/parser/parser.js');
  // await buildProject('client/media/parser/core/toHtmlWorker.js', 'dist/parser/toHtmlWorker.js');

  // 빌드 끝나면 utils, syntax 폴더 복사
  copyParserAssets();
  copyServerExceptionModules();
  copyMedia();
  copyFrontendDist();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
