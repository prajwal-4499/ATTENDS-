@echo off
setlocal enabledelayedexpansion
title Ekdant Attendance - Windows EXE Builder

:: Ensure running in project root directory
cd /d "%~dp0"

echo =====================================================================
echo           EKDANT ATTENDANCE - 1-CLICK WINDOWS EXE BUILDER
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
echo  [2/3] Packaging Windows EXE with Electron...
echo        Please wait...
echo.

node build-exe.js
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
echo  [SUCCESS] WINDOWS EXE BUILD COMPLETE!
echo =====================================================================
echo.
echo  Your installer is located in:
echo    "%~dp0dist-electron\EkdantAttendance Setup 1.0.0.exe"
echo.
echo  Opening the output folder for you now...
echo.

if exist "%~dp0dist-electron" (
    explorer "%~dp0dist-electron"
)

pause
