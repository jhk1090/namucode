const esbuild = require('esbuild');
const fs = require('fs-extra');
const path = require('path');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const quickjsPackages = [
  '@jitl/quickjs-ffi-types',
  '@jitl/quickjs-wasmfile-debug-asyncify',
  '@jitl/quickjs-wasmfile-debug-sync',
  '@jitl/quickjs-wasmfile-release-asyncify',
  '@jitl/quickjs-wasmfile-release-sync',
  'quickjs-emscripten',
  'quickjs-emscripten-core'
];

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: 'esbuild-problem-matcher',
  setup(build) {
    build.onStart(() => {
      console.log(`[watch] build started → ${build.initialOptions.outfile}`);
    });
    build.onEnd(result => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        if (location == null) return;
        console.error(`    ${location.file}:${location.line}:${location.column}:`);
      });
      console.log(`[watch] build finished → ${build.initialOptions.outfile}`);
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
      external: ["vscode", ...(extraOptions.external || []), ...quickjsPackages],
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
  const srcParserDir = path.resolve(__dirname, 'client/media/parser/core');
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

const nodeModulesDir = path.resolve(__dirname, 'client/node_modules');
const distNodeModulesDir = path.resolve(__dirname, 'dist/node_modules');

async function copyQuickJS() {
  for (const pkg of quickjsPackages) {
    const src = path.join(nodeModulesDir, pkg);
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
const mediaFiles = [
  'script.js',
  'reset.css'
];

// 원본 경로
const srcDir = path.resolve(__dirname, 'client/media');
// 복사 대상 경로
const destDir = path.resolve(__dirname, 'dist/media');

async function copyMedia() {
  try {
    // dist/media 폴더 생성
    await fs.ensureDir(destDir);

    for (const file of mediaFiles) {
      const src = path.join(srcDir, file);
      const dest = path.join(destDir, file);

      await fs.copy(src, dest, { overwrite: true });
      console.log(`✅ Copied ${file} to dist/media`);
    }
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
  await buildProject('client/media/parser/core/parser.js', 'dist/parser/parser.js');
  await buildProject('client/media/parser/core/toHtmlWorker.js', 'dist/parser/toHtmlWorker.js');

  // 빌드 끝나면 utils, syntax 폴더 복사
  copyParserAssets();
  copyQuickJS();
  copyMedia();
  copyFrontendDist();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
