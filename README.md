# 🔑 Server Quản Lý & Xác Thực API Key / License Cho Ứng Dụng (App)

Hệ thống Server cấp bản quyền và xác thực API Key chuyên nghiệp, bảo mật, nhẹ và cực kỳ dễ sử dụng. Tích hợp sẵn cơ sở dữ liệu SQLite siêu tốc (không cần cài đặt DB rời), giao diện Web Dashboard trực quan và hỗ trợ khóa theo mã máy phần cứng (HWID).

---

## 🌟 Tính Năng Nổi Bật

1. **Giao diện Web Admin Dashboard**:
   - Truy cập trực tiếp tại: `http://localhost:3000`
   - Tạo Key mới chỉ với 1 click (chọn 1 ngày test, 7 ngày, 30 ngày, 1 năm, hoặc vĩnh viễn).
   - Cho phép sinh hàng loạt key (tối đa 50 key cùng lúc) hoặc tự đặt custom key.
   - Thống kê lượt request, trạng thái key (Active / Blocked / Expired).
   - Nút Reset HWID khi khách hàng đổi máy tính/điện thoại.
   - Nút Khóa / Mở khóa / Xóa / Gia hạn ngày dùng.
   - Theo dõi logs lịch sử ai đang gọi API theo thời gian thực.

2. **Cơ chế Khóa theo mã máy (Hardware ID - HWID Lock)**:
   - Tự động gán mã máy (HWID) vào Key ngay trong lần đầu tiên App của khách chạy.
   - Ngăn chặn khách chia sẻ key cho người khác sử dụng trái phép.
   - Admin có thể bấm nút Reset HWID trên Dashboard bất kỳ lúc nào nếu khách đổi thiết bị.

3. **Cơ sở dữ liệu tích hợp**:
   - Sử dụng SQLite (`keys.db`) có sẵn trong Node.js, không cần cài MySQL hay MongoDB. Dữ liệu lưu bền vững trên ổ đĩa.

4. **Code mẫu tích hợp sẵn**:
   - C# (.NET WinForms / WPF / Console)
   - Python (Tkinter / PyQt / Script)
   - JavaScript / Node.js / React Native / Electron
   - Flutter / Dart
   - cURL / HTTP

---

## 🚀 Hướng Dẫn Khởi Động Server

### Cách 1: Click đúp vào file `start.bat`
Chỉ cần nhấp đúp vào file `start.bat` trong thư mục này.

### Cách 2: Chạy bằng Terminal
```bash
npm start
```

Server sẽ chạy tại địa chỉ:
- **Web Quản Trị**: [http://localhost:3000](http://localhost:3000)
- **Token Admin mặc định**: `admin_secret_key_123`

---

## 📡 Danh Sách API Dành Cho App

### 1. Xác thực Key (`POST /api/v1/verify`)
App gọi endpoint này khi khởi động hoặc định kỳ để kiểm tra bản quyền.

- **URL**: `http://localhost:3000/api/v1/verify`
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`
- **Body**:
```json
{
  "apiKey": "VIP-A1B2C3-D4E5F6-G7H8I9",
  "hwid": "MÃ_MÁY_CỦA_CLIENT"
}
```

- **Phản hồi khi Key hợp lệ (HTTP 200)**:
```json
{
  "valid": true,
  "status": "active",
  "key": "VIP-A1B2C3-D4E5F6-G7H8I9",
  "name": "Nguyễn Văn A",
  "isLifetime": false,
  "expiresAt": "2026-12-24T14:56:43.627Z",
  "daysRemaining": 30,
  "hwid": "MÃ_MÁY_CỦA_CLIENT",
  "serverTime": "2026-11-24T15:00:00.000Z"
}
```

- **Phản hồi khi Key lỗi (HTTP 401 hoặc 403)**:
```json
{
  "valid": false,
  "code": "DEVICE_MISMATCH",
  "message": "Key này đã được kích hoạt trên thiết bị khác. Vui lòng liên hệ Admin để reset mã máy."
}
```

Các mã lỗi `code`:
- `INVALID_KEY`: Key không tồn tại.
- `KEY_BLOCKED`: Key bị admin tạm khóa.
- `KEY_EXPIRED`: Key đã hết hạn ngày sử dụng.
- `DEVICE_MISMATCH`: Khách mang key sang máy khác dùng.

---

### 2. Lấy dữ liệu mật sau khi xác thực (`POST /api/v1/protected-data`)
- **Headers**: `x-api-key: <KEY>`
- Trả về dữ liệu nội bộ bảo mật của app (config, link download, token ẩn).

---

## 📁 Cấu Trúc Thư Mục

```
key-server/
├── client-examples/              # Code mẫu gắn vào App
│   ├── csharp-winforms-wpf.cs   # Code mẫu C# (.NET)
│   ├── python_example.py        # Code mẫu Python
│   ├── nodejs_or_web.js         # Code mẫu JavaScript
│   └── curl_test.bat            # File test nhanh bằng curl
├── public/                       # Giao diện Web Admin Dashboard
│   └── index.html               # Trang quản trị đầy đủ tính năng
├── src/
│   ├── config.js                # Cấu hình PORT & ADMIN_TOKEN
│   ├── database.js              # Quản lý SQLite database
│   ├── server.js                # Khởi tạo Express Server
│   └── routes/
│       ├── client.js            # API cho App (/api/v1)
│       └── admin.js             # API cho Admin (/api/admin)
├── keys.db                      # File cơ sở dữ liệu SQLite
├── package.json
├── start.bat                    # Chạy 1 click trên Windows
└── README.md
```
