@echo off
title Small Label Printing - Server
echo.
echo  =========================================
echo   Small Label Printing - Starting Server
echo  =========================================
echo.

:: Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Node.js is not installed!
    echo.
    echo  Please install Node.js from: https://nodejs.org
    echo  Download the "LTS" version and run the installer.
    echo  Then re-run this file.
    echo.
    pause
    exit /b 1
)

echo  Node.js found:
node --version
echo.

:: Install dependencies if node_modules is missing
if not exist "node_modules\" (
    echo  Installing dependencies (first-time setup)...
    npm install
    if errorlevel 1 (
        echo  ERROR: npm install failed. Check your internet connection.
        pause
        exit /b 1
    )
    echo.
)

:: Build the app if dist/index.html is missing
if not exist "dist\index.html" (
    echo  Building the app (first-time setup)...
    npm run build
    if errorlevel 1 (
        echo  ERROR: Build failed.
        pause
        exit /b 1
    )
    echo.
)

echo  Starting server...
echo  Other PCs on the network can connect to this PC.
echo.
node app.js
pause
