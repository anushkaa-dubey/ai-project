@echo off
echo Starting AI Copilot Frontend...
cd /d "%~dp0frontend"
python -m http.server 3000
