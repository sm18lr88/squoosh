@echo off
title Squoosh Web App
echo.
echo  ========================================
echo   Squoosh - Image Compression Web App
echo  ========================================
echo.
echo  Starting development server...
echo  The browser will open automatically.
echo.
echo  Press Ctrl+C to stop the server.
echo.

cd /d "%~dp0"

:: Start the browser after a short delay (gives server time to start)
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5000"

:: Run the dev server
npm run dev
