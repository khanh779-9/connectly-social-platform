@echo off
REM =============================================================================
REM Connectly Backend - Stop All Services (double-click to stop everything)
REM =============================================================================

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-all.ps1"

echo.
pause >nul
