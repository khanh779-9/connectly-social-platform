@echo off
REM =============================================================================
REM Connectly Backend - Run All Services (double-click to start, hidden mode)
REM Starts Identity, Social, Chat, Notification, Gateway as HIDDEN processes.
REM Logs: backend\logs\*.log   Stop: stop-all.bat
REM =============================================================================

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-all.ps1"

echo.
echo Close this window - services keep running in the background.
echo To stop them, double-click stop-all.bat
pause >nul
