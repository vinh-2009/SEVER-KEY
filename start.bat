@echo off
title Key & License Server
chcp 65001 > nul
cd /d "%~dp0"

echo =======================================================
echo          KHỞI ĐỘNG KEY & LICENSE API SERVER
echo =======================================================
echo.
echo * Server URL   : http://localhost:3000
echo * Admin Token  : admin_secret_key_123
echo * Cơ sở dữ liệu: SQLite (keys.db)
echo.
echo Nhấn Ctrl + C để dừng server khi cần.
echo.

node src/server.js
pause
