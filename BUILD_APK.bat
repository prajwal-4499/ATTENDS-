@echo off
setlocal enabledelayedexpansion
title Ekdant Attendance - Android APK Builder

:: Ensure running in project root directory
cd /d "%~dp0"

echo =====================================================================
echo           EKDANT ATTENDANCE - 1-CLICK ANDROID APK BUILDER
echo =====================================================================
echo.
echo  [1/3] Checking environment...

:: Verify Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo.
    echo  [X] ERROR: Node.js was not found on your system!
    echo      Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo        - Node.js found: OK
echo.
echo  [2/3] Building Android APK (Vite bundle, Capacitor sync, Gradle)...
echo        Please wait, this may take 30-60 seconds...
echo.

:: Run the APK build script
node build-apk.js
if %ERRORLEVEL% neq 0 (
    echo.
    echo =====================================================================
    echo  [X] BUILD FAILED! Check the error details above.
    echo =====================================================================
    echo.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo =====================================================================
echo  [SUCCESS] APK BUILD COMPLETE!
echo =====================================================================
echo.
echo  Your APK file is located in:
echo    "%~dp0dist-apk\EkdantAttendance.apk"
echo.
echo  Opening the output folder for you now...
echo.

:: Automatically open Explorer showing the generated APK file
if exist "%~dp0dist-apk" (
    explorer "%~dp0dist-apk"
)

pause
