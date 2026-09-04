@echo off
REM Обёртка для запуска deploy.ps1 из cmd. Просто: deploy
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy.ps1" %*
