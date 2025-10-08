@echo off
echo Starting Vizzerdrix Development Environment...
echo.
echo This will start:
echo - Web Client (Angular) on http://localhost:4200
echo - Game Server (Node.js) on http://localhost:3000
echo.
echo Press Ctrl+C to stop both servers
echo.

start "Web Client" cmd /k "cd /d %~dp0 && npx nx serve:dev web-client"
timeout /t 3 /nobreak >nul
start "Game Server" cmd /k "cd /d %~dp0 && npx nx serve:dev server"

echo.
echo Development servers starting...
echo Web Client: http://localhost:4200
echo Game Server: http://localhost:3000
echo.
pause