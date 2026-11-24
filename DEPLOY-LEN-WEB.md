# 🌐 HƯỚNG DẪN XUẤT SERVER KEY RA MẠNG WEB (PUBLIC INTERNET)

Để người dùng ở các máy tính khác hoặc trên điện thoại có thể xác thực API Key từ xa qua Internet, bạn cần một đường link Web công khai (`https://...`). Dưới đây là 3 cách dễ nhất:

---

## 🚀 CÁCH 1: Đưa Lên Cloud Miễn Phí 24/7 (Khuyên Dùng Nhất - Render.com)

Render là dịch vụ máy chủ đám mây miễn phí 100%, server sẽ chạy vĩnh viễn 24/24 trên mạng mà **không cần bạn phải bật máy tính**.

### Các bước thực hiện (chỉ mất 2 phút):
1. **Tạo tài khoản:** Truy cập [https://render.com](https://render.com) và đăng ký miễn phí (bằng GitHub hoặc Email).
2. **Đưa mã nguồn lên GitHub:**
   - Tạo 1 repository mới trên [https://github.com](https://github.com) (chế độ Private hoặc Public).
   - Tải toàn bộ thư mục `key-server` này lên GitHub (trừ thư mục `node_modules`).
3. **Kết nối vào Render:**
   - Trên Dashboard của Render, bấm **New +** $\rightarrow$ chọn **Web Service**.
   - Chọn kho lưu trữ GitHub bạn vừa tải lên.
   - Điền các thông số:
     - **Name**: `my-app-key-server` (hoặc tên tùy bạn thích)
     - **Runtime**: `Node`
     - **Build Command**: `npm install --omit=dev`
     - **Start Command**: `node src/server.js`
     - **Instance Type**: `Free`
   - Bấm **Create Web Service**.
4. **Nhận link Web:**
   - Sau khoảng 1-2 phút, Render sẽ cấp cho bạn một đường link web cố định dạng:
     `https://my-app-key-server.onrender.com`
   - Bạn chỉ cần copy link này gắn vào App của mình!

---

## ⚡ CÁCH 2: Mở Link Web Ngay Từ Máy Tính Bằng 1-Click (Dùng Thử Ngay)

Nếu bạn chưa muốn tạo tài khoản cloud mà muốn có ngay một đường link Web để test thử cho bạn bè hoặc người khác:

1. Đảm bảo server đang chạy (bằng file [start.bat](file:///C:/Users/ADMIN/.gemini/antigravity/scratch/key-server/start.bat)).
2. Nhấp đúp chuột vào file [mo-port-ra-web.bat](file:///C:/Users/ADMIN/.gemini/antigravity/scratch/key-server/mo-port-ra-web.bat).
3. Màn hình sẽ hiện ra đường link web công khai, ví dụ:
   `your url is: https://cold-cats-run.loca.lt`
4. Bất kỳ ai trên thế giới cũng có thể truy cập vào link này để xác thực Key qua Internet!

---

## 🖥️ CÁCH 3: Cài Đặt Lên VPS Riêng (Ubuntu / Debian Linux)

Nếu bạn có VPS riêng (DigitalOcean, Vultr, Linode, Hetzner, AWS, hoặc VPS Việt Nam):

```bash
# 1. Cài đặt Node.js
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs git

# 2. Upload thư mục key-server lên VPS và di chuyển vào thư mục
cd key-server

# 3. Cài đặt thư viện
npm install --omit=dev

# 4. Cài đặt PM2 để chạy ngầm vĩnh viễn
sudo npm install -g pm2
pm2 start src/server.js --name "key-server"
pm2 startup
pm2 save
```

---

## 🔄 Cách Thay Link Web Vào Ứng Dụng (App) Của Bạn

Khi bạn đã có link Web (ví dụ `https://my-app-key-server.onrender.com`), hãy mở code App của bạn và thay đổi:

* **Trước đây (Chạy local trên máy):**
  ```csharp
  private const string SERVER_URL = "http://localhost:3000/api/v1/verify";
  ```
* **Sau khi xuất ra Web:**
  ```csharp
  private const string SERVER_URL = "https://my-app-key-server.onrender.com/api/v1/verify";
  ```

Tất cả các chức năng: Xác thực Key, Khóa mã máy HWID, Gia hạn ngày, Quản trị Dashboard đều hoạt động trực tiếp qua mạng Internet!
