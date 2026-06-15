@echo off
REM ============================================================
REM  CoVet QA Brain - start the local server
REM  Double-click this file, then open http://localhost:3000
REM  Keep this window open while you use the site.
REM ============================================================
cd /d "%~dp0"

REM Make sure Node.js is on the PATH for this window.
where node >nul 2>nul
if errorlevel 1 set "PATH=C:\Program Files\nodejs;%PATH%"

echo.
echo  Starting CoVet QA Brain...
echo  When you see "Ready", open  http://localhost:3000
echo  Press Ctrl+C or close this window to stop.
echo.

call npm run dev

echo.
echo  Server stopped. Press any key to close.
pause >nul
