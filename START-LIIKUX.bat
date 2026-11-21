@echo off
rem Starts Liikux on your computer: the API and the site (also for your phone).
rem Double-click this file. Two black windows open: leave them open while you work.
rem Close them (or press Ctrl+C in them) to stop.

cd /d "%~dp0"
start "Liikux API" cmd /k "cd /d %~dp0server && npm run dev"
start "Liikux site" cmd /k "cd /d %~dp0client && npm run dev -- --host"

echo Waiting for the servers...
timeout /t 12 /nobreak >nul
start "" "http://localhost:5173/admin/tarkistus"
echo.
echo Review page:   http://localhost:5173/admin/tarkistus
echo On your phone: http://192.168.1.214:5173/admin/tarkistus  (same Wi-Fi)
echo Admin key:     the ADMIN_KEY line in server\.env
pause
