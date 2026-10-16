#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║        EKDANT ATTENDANCE — Android APK Builder                  ║
 * ║  Uses Capacitor + Android SDK to build a real Android APK       ║
 * ║  Run: node build-apk.js  (or  npm run build:apk)                ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = __dirname;
const ANDROID_DIR = path.join(ROOT, 'android');
const DIST_APK_DIR = path.join(ROOT, 'dist-apk');

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

// Detect JDK 21+ (check Android Studio bundled JBR first as Capacitor 8 requires Java 21)
function detectJdk21() {
  const candidates = [
    'C:\\Program Files\\Android\\Android Studio\\jbr',
    'C:\\Program Files\\Java\\jdk-21',
    process.env.JAVA_HOME,
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(path.join(c, 'bin', process.platform === 'win32' ? 'javac.exe' : 'javac'))) {
      return c;
    }
  }
  return null;
}

const jdk21Path = detectJdk21();
if (jdk21Path) {
  process.env.JAVA_HOME = jdk21Path;
  process.env.PATH = `${path.join(jdk21Path, 'bin')}${path.delimiter}${process.env.PATH}`;
  ok(`Using JDK 21: ${jdk21Path}`);
} else {
  const javaCheck = spawnSync('java -version', { shell: true, stdio: 'pipe' });
  if (javaCheck.status !== 0) {
    fail('Java JDK not found! Install JDK from Android Studio or https://adoptium.net/');
    process.exit(1);
  }
  ok('Java found on PATH');
}

// Detect Android SDK
function detectAndroidSdk() {
  if (process.env.ANDROID_HOME && fs.existsSync(process.env.ANDROID_HOME)) {
    return process.env.ANDROID_HOME;
  }
  if (process.env.ANDROID_SDK_ROOT && fs.existsSync(process.env.ANDROID_SDK_ROOT)) {
    return process.env.ANDROID_SDK_ROOT;
  }
  const defaultPaths = [
    path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk'),
    path.join(os.homedir(), 'Library', 'Android', 'sdk'),
    path.join(os.homedir(), 'Android', 'Sdk'),
  ];
  for (const p of defaultPaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const sdkPath = detectAndroidSdk();
if (sdkPath) {
  process.env.ANDROID_HOME = sdkPath;
  process.env.ANDROID_SDK_ROOT = sdkPath;
  ok(`Android SDK located: ${sdkPath}`);
} else {
  warn('Android SDK not detected automatically.');
  warn('Please set ANDROID_HOME or install Android Studio.');
}

// ─── Step 1: Install Capacitor packages ──────────────────────────────────────
console.log('\n' + C.bold('-- Step 1/6  Verifying Capacitor packages --'));
run('npm install @capacitor/core @capacitor/cli @capacitor/android');
ok('Capacitor packages verified');

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
console.log('\n' + C.bold('-- Step 4/6  Checking Android platform --'));

if (!fs.existsSync(ANDROID_DIR)) {
  run('npx cap add android');
  ok('Android platform scaffolded -> android/');
} else {
  ok('android/ directory already exists');
}

// Ensure android/local.properties points to SDK
if (sdkPath) {
  const localPropsPath = path.join(ANDROID_DIR, 'local.properties');
  const formattedSdkPath = sdkPath.replace(/\\/g, '/');
  fs.writeFileSync(localPropsPath, `sdk.dir=${formattedSdkPath}\n`);
  ok('android/local.properties configured with SDK path');
}

// Ensure android/gradle.properties points to JDK 21
if (jdk21Path) {
  const gradlePropsPath = path.join(ANDROID_DIR, 'gradle.properties');
  if (fs.existsSync(gradlePropsPath)) {
    let content = fs.readFileSync(gradlePropsPath, 'utf8');
    const formattedJdk = jdk21Path.replace(/\\/g, '/');
    if (content.includes('org.gradle.java.home=')) {
      content = content.replace(/org\.gradle\.java\.home=.*(\r?\n|$)/, `org.gradle.java.home=${formattedJdk}\n`);
    } else {
      content += `\norg.gradle.java.home=${formattedJdk}\n`;
    }
    fs.writeFileSync(gradlePropsPath, content);
    ok('android/gradle.properties configured with org.gradle.java.home');
  }
}

// ─── Step 5: Sync web assets into Android project ────────────────────────────
console.log('\n' + C.bold('-- Step 5/6  Syncing web assets to Android --'));
run('npx cap sync android');
ok('Assets synced to android/');

// ─── Step 6: Build the APK via Gradle ────────────────────────────────────────
console.log('\n' + C.bold('-- Step 6/6  Building APK with Gradle --'));
warn('Gradle is building assembleDebug inside android/ folder...');

const gradleCmd = process.platform === 'win32'
  ? '.\\gradlew.bat assembleDebug'
  : './gradlew assembleDebug';

run(gradleCmd, { cwd: ANDROID_DIR });

// ─── Deliver APK to dist-apk/ and clean up unnecessary build files ───────────
const rawApkPath = path.join(ANDROID_DIR, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

if (!fs.existsSync(DIST_APK_DIR)) {
  fs.mkdirSync(DIST_APK_DIR, { recursive: true });
}

const finalApkPath = path.join(DIST_APK_DIR, 'ATTENDS.apk');

if (fs.existsSync(rawApkPath)) {
  fs.copyFileSync(rawApkPath, finalApkPath);
  fs.copyFileSync(rawApkPath, path.join(DIST_APK_DIR, 'EkdantAttendance.apk'));
  fs.copyFileSync(rawApkPath, path.join(DIST_APK_DIR, 'app-debug.apk'));
}

// Clean up heavy temporary build folders that are not necessary
const tempFolders = [
  path.join(ANDROID_DIR, '.gradle'),
  path.join(ANDROID_DIR, 'build'),
  path.join(ANDROID_DIR, 'app', 'build', 'intermediates'),
  path.join(ANDROID_DIR, 'app', 'build', 'tmp'),
  path.join(ANDROID_DIR, 'capacitor-cordova-android-plugins', 'build'),
];

for (const folder of tempFolders) {
  try {
    if (fs.existsSync(folder)) {
      fs.rmSync(folder, { recursive: true, force: true });
    }
  } catch (e) {
    // Non-fatal if Gradle daemon is still locking a cache file
  }
}

// ─── Done ─────────────────────────────────────────────────────────────────────
const apkExists = fs.existsSync(finalApkPath);

console.log('\n' + C.green(C.bold('================================================')));
if (apkExists) {
  console.log(C.green(C.bold('  🎉 Android APK Build Successful!')));
  console.log(C.cyan('  APK Location : ') + C.bold(finalApkPath));
  console.log('\n  To install directly onto a connected phone:');
  console.log(C.bold(`    adb install "${finalApkPath}"`));
  console.log('\n  Or transfer ATTENDS.apk to your Android phone.');
} else {
  warn('APK build output was not found. Please review Gradle logs above.');
}
console.log(C.green(C.bold('================================================')) + '\n');
