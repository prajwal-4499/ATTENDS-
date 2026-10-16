#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║          EKDANT ATTENDANCE — Windows EXE Builder                ║
 * ║  Uses Electron + electron-builder to package into .exe          ║
 * ║  Run: node build-exe.js  (or  npm run build:exe)                ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = __dirname;

// ─── Colours ─────────────────────────────────────────────────────────────────
const C = {
  green  : (s) => `\x1b[32m${s}\x1b[0m`,
  yellow : (s) => `\x1b[33m${s}\x1b[0m`,
  red    : (s) => `\x1b[31m${s}\x1b[0m`,
  cyan   : (s) => `\x1b[36m${s}\x1b[0m`,
  bold   : (s) => `\x1b[1m${s}\x1b[0m`,
};

function log(msg)  { console.log(C.cyan('  > ') + msg); }
function ok(msg)   { console.log(C.green('  ok ') + msg); }
function warn(msg) { console.log(C.yellow('  ! ') + msg); }
function fail(msg) { console.error(C.red('  x ') + msg); }

function run(cmd, opts = {}) {
  log(`Running: ${C.bold(cmd)}`);
  const result = spawnSync(cmd, { shell: true, stdio: 'inherit', cwd: ROOT, ...opts });
  if (result.status !== 0) {
    fail(`Command failed with code ${result.status}`);
    process.exit(result.status);
  }
}

// ─── Step 1: Install dev dependencies ────────────────────────────────────────
console.log('\n' + C.bold('-- Step 1/5  Installing Electron build tools --'));
run('npm install --save-dev electron electron-builder');

// ─── Step 2: Build Vite web app ───────────────────────────────────────────────
console.log('\n' + C.bold('-- Step 2/5  Building Vite web bundle --'));
run('npm run build');
ok('Vite build complete -> dist/');

// ─── Step 3: Create Electron main process file ───────────────────────────────
console.log('\n' + C.bold('-- Step 3/5  Writing electron-main.js --'));

const electronMain = `
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: 'Ekdant Attendance & Payroll',
    icon: path.join(__dirname, 'dist', 'favicon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
  });

  win.loadFile(path.join(__dirname, 'dist', 'index.html'));

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
`.trim();

fs.writeFileSync(path.join(ROOT, 'electron-main.js'), electronMain + '\n');
ok('electron-main.js created');

// ─── Step 4: Inject electron config into package.json ────────────────────────
console.log('\n' + C.bold('-- Step 4/5  Updating package.json with electron-builder config --'));

const pkgPath = path.join(ROOT, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

pkg.main = 'electron-main.js';
pkg.scripts = pkg.scripts || {};
pkg.scripts['electron'] = 'electron .';

pkg.build = {
  appId        : 'com.ekdant.attendance',
  productName  : 'EkdantAttendance',
  copyright    : 'Copyright 2024 Ekdant Shop',
  directories  : { output: 'dist-electron' },
  files        : ['dist/**/*', 'electron-main.js'],
  win: {
    target     : [{ target: 'nsis', arch: ['x64'] }],
    icon       : 'public/favicon.ico',
  },
  nsis: {
    oneClick         : false,
    allowToChangeInstallationDirectory: true,
    installerLanguages: ['en_US'],
  },
  mac: {
    target   : 'dmg',
    category : 'public.app-category.business',
  },
  linux: {
    target   : 'AppImage',
    category : 'Office',
  },
};

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
ok('package.json updated with electron-builder config');

// ─── Step 5: Package into .exe ────────────────────────────────────────────────
console.log('\n' + C.bold('-- Step 5/5  Packaging Windows EXE --'));
warn('This may take a few minutes on first run (downloads Electron binaries)...');
run('npx electron-builder --win --x64');

console.log('\n' + C.green(C.bold('================================================')));
console.log(C.green(C.bold('  EXE build complete!')));
console.log(C.cyan('  Output folder : ') + C.bold('dist-electron/'));
console.log(C.cyan('  File          : ') + C.bold('EkdantAttendance Setup *.exe'));
console.log(C.green(C.bold('================================================')) + '\n');
