@echo off
echo Starting local server at http://localhost:8000
python -V >nul 2>&1 || (
  echo Python not found. Install Python 3 from https://www.python.org/downloads/
  pause
  exit /b
)
python -m http.server 8000
