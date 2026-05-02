import { build, context } from 'esbuild';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');
const isWatch = process.argv.includes('--watch');

const sharedConfig = {
  bundle: true,
  sourcemap: 'external' as const,
  format: 'esm' as const,
  target: 'chrome114',
  platform: 'browser' as const,
  jsx: 'automatic' as const,
  jsxImportSource: 'preact',
  tsconfig: path.join(rootDir, 'tsconfig.json'),
  alias: {
    '@': path.join(rootDir, 'src'),
  },
  minify: true,
  treeShaking: true,
  drop: ['console'] as import('esbuild').Drop[],
  legalComments: 'none' as const,
};

async function copyStatic() {
  await mkdir(path.join(distDir, 'assets', 'icons'), { recursive: true });
  await Promise.all([
    copyFile(path.join(rootDir, 'manifest.json'), path.join(distDir, 'manifest.json')),
    copyFile(path.join(rootDir, 'src', 'popup', 'index.html'), path.join(distDir, 'popup.html')),
    copyFile(path.join(rootDir, 'src', 'settings', 'index.html'), path.join(distDir, 'settings.html')),
    copyFile(path.join(rootDir, 'src', 'ui', 'base.css'), path.join(distDir, 'base.css')),
    copyFile(path.join(rootDir, 'assets', 'icons', 'icon16.png'), path.join(distDir, 'assets', 'icons', 'icon16.png')),
    copyFile(path.join(rootDir, 'assets', 'icons', 'icon32.png'), path.join(distDir, 'assets', 'icons', 'icon32.png')),
    copyFile(path.join(rootDir, 'assets', 'icons', 'icon48.png'), path.join(distDir, 'assets', 'icons', 'icon48.png')),
    copyFile(path.join(rootDir, 'assets', 'icons', 'icon128.png'), path.join(distDir, 'assets', 'icons', 'icon128.png')),
  ]);
}

async function runBuild() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  const entryPoints = {
    background: path.join(rootDir, 'src', 'background', 'service-worker.ts'),
    content: path.join(rootDir, 'src', 'content', 'index.ts'),
    popup: path.join(rootDir, 'src', 'popup', 'index.tsx'),
    settings: path.join(rootDir, 'src', 'settings', 'index.tsx'),
  };

  if (isWatch) {
    const ctx = await context({
      ...sharedConfig,
      entryPoints,
      outdir: distDir,
    });
    await ctx.watch();
    await copyStatic();
    console.log('Watching Simply Mail...');
    return;
  }

  await build({
    ...sharedConfig,
    entryPoints,
    outdir: distDir,
  });
  await copyStatic();
  console.log('Built Simply Mail into dist/');
}

void runBuild();
