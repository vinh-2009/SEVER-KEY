@echo off
title Mở Server Key Ra Web Internet (Public Link)
chcp 65001 > nul
cd /d "%~dp0"

echo =======================================================================
echo          CÔNG CỤ MỞ SERVER KEY RA WEB INTERNET (PUBLIC HTTPS)
echo =======================================================================
echo.
echo Công cụ này sẽ tạo một đường link Web (HTTPS) công khai trên internet
echo để người dùng từ máy khác có thể kết nối vào App của bạn ngay lập tức!
echo.
echo [1] Dùng Localtunnel (Miễn phí, không cần đăng nhập)
echo [2] Dùng Localhost.run (Chạy qua SSH, cực nhẹ)
echo.
set /p CHOICE="Nhập lựa chọn của bạn (1 hoặc 2, mặc định là 1): "

if "%CHOICE%"=="2" goto SSH_TUNNEL
goto LOCAL_TUNNEL

:LOCAL_TUNNEL
echo.
echo [*] Đang khởi tạo đường link Web bằng Localtunnel...
echo [*] Hãy đảm bảo server local vẫn đang chạy (start.bat)!
echo.
npx localtunnel --port 3000
pause
exit

:SSH_TUNNEL
echo.
echo [*] Đang kết nối tunnel qua SSH localhost.run...
echo.
ssh -R 80:localhost:3000 nokey@localhost.run
pause
exit
