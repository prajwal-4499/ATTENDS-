#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║        EKDANT ATTENDANCE — Android APK Builder                  ║
 * ║  Uses Capacitor + Android SDK to build a real Android APK       ║
 * ║  Run: node build-apk.js                                         ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Prerequisites you must install MANUALLY before running this script:
 *   1. Java JDK 17+     → https://adoptium.net/
 *   2. Android Studio   → https://developer.android.com/studio
 *      (includes Android SDK, SDK Build-Tools 34, platform 34)
 *   3. Set ANDROID_HOME environment variable to your SDK path:
 *      e.g. C:\Users\<you>\AppData\Local\Android\Sdk
 *
 * The script auto-installs:
 *   • @capacitor/core
 *   • @capacitor/cli
 *   • @capacitor/android
 *
 * Output: android/app/build/outputs/apk/debug/app-debug.apk
 *   OR release (if you have a keystore configured):
 *         android/app/build/outputs/apk/release/app-release.apk
 */

const { spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

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

// ─── Pre-flight check ────────────────────────────────────────────────────────
console.log('\n' + C.bold('-- Pre-flight checks --'));

const javaCheck = spawnSync('java -version', { shell: true, stdio: 'pipe' });
if (javaCheck.status !== 0) {
  fail('Java JDK not found! Install JDK 17+ from https://adoptium.net/');
  fail('Then re-run this script.');
  process.exit(1);
}
ok('Java JDK found');

if (!process.env.ANDROID_HOME && !process.env.ANDROID_SDK_ROOT) {
  warn('ANDROID_HOME environment variable is not set.');
  warn('Set it to your Android SDK path, e.g.:');
  warn('  Windows: C:\\Users\\<you>\\AppData\\Local\\Android\\Sdk');
  warn('  Mac/Linux: ~/Library/Android/sdk  OR  ~/Android/Sdk');
  warn('Continuing anyway — Gradle may still find the SDK automatically...');
} else {
  ok(`Android SDK: ${process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT}`);
}

// ─── Step 1: Install Capacitor packages ──────────────────────────────────────
console.log('\n' + C.bold('-- Step 1/6  Installing Capacitor packages --'));
run('npm install @capacitor/core @capacitor/cli @capacitor/android');
ok('Capacitor packages installed');

// ─── Step 2: Build Vite web app ───────────────────────────────────────────────
console.log('\n' + C.bold('-- Step 2/6  Building Vite web bundle --'));
run('npm run build');
ok('Vite build complete -> dist/');

// ─── Step 3: Create / update capacitor.config.json ───────────────────────────
console.log('\n' + C.bold('-- Step 3/6  Writing capacitor.config.json --'));

const capConfig = {
  appId    : 'com.ekdant.attendance',
  appName  : 'Ekdant Attendance',
  webDir   : 'dist',
  server   : { androidScheme: 'https' },
  plugins  : {
    SplashScreen: {
      launchShowDuration : 1500,
      backgroundColor    : '#0f172a',
      showSpinner        : false,
    },
  },
};

fs.writeFileSync(
  path.join(ROOT, 'capacitor.config.json'),
  JSON.stringify(capConfig, null, 2) + '\n'
);
ok('capacitor.config.json written');

// ─── Step 4: Init Capacitor Android platform ─────────────────────────────────
console.log('\n' + C.bold('-- Step 4/6  Adding Android platform --'));

const androidDir = path.join(ROOT, 'android');
if (!fs.existsSync(androidDir)) {
  run('npx cap add android');
  ok('Android platform scaffolded -> android/');
} else {
  ok('android/ directory already exists — skipping cap add');
}

// ─── Step 5: Sync web assets into Android project ────────────────────────────
console.log('\n' + C.bold('-- Step 5/6  Syncing web assets to Android --'));
run('npx cap sync android');
ok('Assets synced to android/');

// ─── Step 6: Build the APK via Gradle ────────────────────────────────────────
console.log('\n' + C.bold('-- Step 6/6  Building APK with Gradle --'));
warn('This step may take 5-10 minutes on first run (Gradle downloads dependencies)...');

const gradleCmd = process.platform === 'win32'
  ? '.\\android\\gradlew.bat assembleDebug'
  : './android/gradlew assembleDebug';

run(gradleCmd, { cwd: ROOT });

// ─── Done ─────────────────────────────────────────────────────────────────────
const apkPath = path.join('android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const apkExists = fs.existsSync(path.join(ROOT, apkPath));

console.log('\n' + C.green(C.bold('================================================')));
if (apkExists) {
  console.log(C.green(C.bold('  APK build complete!')));
  console.log(C.cyan('  APK location: ') + C.bold(apkPath));
  console.log('\n  To install on a connected Android device:');
  console.log(C.bold('    adb install ' + apkPath));
  console.log('\n  To open in Android Studio:');
  console.log(C.bold('    npx cap open android'));
} else {
  warn('APK may not have been generated. Check Gradle output above for errors.');
  console.log('  Expected APK path: ' + apkPath);
  console.log('  You can also open Android Studio and build from there:');
  console.log(C.bold('    npx cap open android'));
}
console.log(C.green(C.bold('================================================')) + '\n');
