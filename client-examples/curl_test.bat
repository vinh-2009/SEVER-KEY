@echo off
chcp 65001 > nul
echo =======================================================
echo          TEST XÁC THỰC API KEY SERVER (CURL)
echo =======================================================

set /p KEY="Nhập API Key cần kiểm tra: "
set /p HWID="Nhập mã máy (bấm Enter để để trống): "

echo.
echo Đang gửi yêu cầu xác thực tới http://localhost:3000/api/v1/verify ...
echo.

curl -X POST "http://localhost:3000/api/v1/verify" ^
  -H "Content-Type: application/json" ^
  -d "{\"apiKey\": \"%KEY%\", \"hwid\": \"%HWID%\"}"

echo.
echo.
pause
