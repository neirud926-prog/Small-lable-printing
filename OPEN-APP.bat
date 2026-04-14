@echo off
:: Open the app directly in the browser (single-PC mode, no server needed)
if exist "dist\index.html" (
    start "" "%~dp0dist\index.html"
) else (
    echo  ERROR: dist\index.html not found.
    echo  Please run START-SERVER.bat first to build the app.
    echo  (Requires Node.js - https://nodejs.org)
    pause
)
