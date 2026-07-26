@echo off
echo Starting AI Copilot Frontend...
cd /d "%~dp0frontend"
py -3.11 -m http.server 3000
