#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║        EKDANT ATTENDANCE — Android APK Builder                  ║
 * ║  Uses Capacitor + Android SDK to build a real Android APK       ║
 * ║  Run: node build-apk.cjs  (or  npm run build:apk)               ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

const { spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const ROOT = __dirname;
const ANDROID_DIR = path.join(ROOT, 'android');

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
console.log('\n' + C.bold('-- Step 1/6  Installing Capacitor packages --'));
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

// Crucial: run Gradle inside the android/ directory so it finds settings.gradle and build.gradle!
run(gradleCmd, { cwd: ANDROID_DIR });

// ─── Done ─────────────────────────────────────────────────────────────────────
const apkPath = path.join('android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const fullApkPath = path.join(ROOT, apkPath);
const apkExists = fs.existsSync(fullApkPath);

console.log('\n' + C.green(C.bold('================================================')));
if (apkExists) {
  console.log(C.green(C.bold('  🎉 Android APK Build Successful!')));
  console.log(C.cyan('  APK Path : ') + C.bold(fullApkPath));
  console.log('\n  To install directly onto a USB-connected phone:');
  console.log(C.bold('    adb install "' + fullApkPath + '"'));
  console.log('\n  Or transfer the file app-debug.apk to your Android phone via USB/WhatsApp/Drive.');
} else {
  warn('Build completed but APK output not found at: ' + apkPath);
  console.log('  You can also open Android Studio to build:');
  console.log(C.bold('    npx cap open android'));
}
console.log(C.green(C.bold('================================================')) + '\n');
