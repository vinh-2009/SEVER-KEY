# 🌐 HƯỚNG DẪN CẤU HÌNH SERVER CHẠY 24/24 & LƯU TRỮ VĨNH VIỄN (KHÔNG MẤT KEY CŨ)

Tài liệu này giải quyết triệt để 2 vấn đề lớn nhất khi đưa server lên mạng miễn phí:
1. **Server chạy thông suốt 24/24:** Không bị ngủ đông, App của khách mở lên là kết nối được ngay lập tức.
2. **Không bao giờ bị mất hoặc reset Key cũ:** Dữ liệu lưu vĩnh viễn trên Cloud Database hoặc tự động sao lưu.

---

## ⚡ PHẦN 1: CÁCH GIỮ SERVER HOẠT ĐỘNG 24/24 (KHÔNG BỊ NGỦ ĐÔNG)

Trên các nền tảng miễn phí như Render.com, nếu sau 15 phút không có ai vào thì server sẽ tạm "ngủ". Để server luôn thức 24/24:

### Cách thiết lập UptimeRobot (Miễn phí 100% - chỉ làm 1 lần):
1. Truy cập [https://uptimerobot.com](https://uptimerobot.com) và đăng ký tài khoản miễn phí.
2. Bấm nút **+ Add New Monitor**:
   - **Monitor Type**: Chọn `HTTP(s)`
   - **Friendly Name**: Đặt tên (ví dụ: `Server Key 24/24`)
   - **URL (or IP)**: Dán link ping của bạn vào, ví dụ:  
     `https://ten-app-cua-ban.onrender.com/api/v1/ping`
   - **Monitoring Interval**: Chọn `5 minutes` (5 phút gọi 1 lần)
3. Bấm **Create Monitor**.
$\rightarrow$ **Kết quả:** UptimeRobot sẽ tự động "đánh thức" server của bạn 5 phút/lần. Server sẽ **chạy xuyên suốt 24/24, 365 ngày/năm** không bao giờ bị tắt!

---

## 🔒 PHẦN 2: CÁCH ĐẢM BẢO KEY CŨ KHÔNG BAO GIỜ BỊ RESET (LƯU TRỮ VĨNH VIỄN)

Khi chạy trên cloud miễn phí, nếu server khởi động lại thì ổ đĩa tạm thời có thể bị làm mới. Dưới đây là 2 cách để đảm bảo an toàn dữ liệu 100%:

### Cách A: Dùng Cloud Database miễn phí (Khuyên Dùng - Tự Động 100%)
Server đã được tích hợp sẵn khả năng tự động kết nối Cloud PostgreSQL.
1. Bạn có thể tạo 1 database PostgreSQL miễn phí tại [https://neon.tech](https://neon.tech) hoặc tạo luôn mục **PostgreSQL** trên [Render.com](https://render.com).
2. Lấy đường link kết nối (dạng `postgres://user:password@ep-xyz.neon.tech/neondb...`).
3. Vào dịch vụ Web Service của bạn trên Render $\rightarrow$ chọn **Environment** $\rightarrow$ thêm biến môi trường:
   - **Key**: `DATABASE_URL`
   - **Value**: Dán link `postgres://...` vừa lấy ở trên vào.
4. Bấm **Save Changes**.
$\rightarrow$ **Kết quả:** Toàn bộ Key và lượt truy cập sẽ được lưu vĩnh viễn trên Cloud Database. Dù bạn có nâng cấp code hay restart server 1000 lần thì **100% key cũ vẫn nguyên vẹn**!

---

### Cách B: Dùng Tính Năng Sao Lưu & Phục Hồi 1-Click (Ngay Trên Dashboard)
Nếu bạn vẫn dùng SQLite cục bộ:
1. **Nút "📥 Sao Lưu":** Bấm nút này trên Web Dashboard bất cứ lúc nào để tải về file `keys-backup-YYYY-MM-DD.json` lưu trữ an toàn trong máy tính của bạn.
2. **Nút "📤 Khôi Phục":** Khi bạn chuyển sang server mới hoặc sau khi deploy, chỉ cần bấm nút này và chọn file JSON backup $\rightarrow$ toàn bộ Key cũ sẽ được nạp lại trong 1 giây!
3. **Cơ chế tự động:** Server cũng tự động ghi nhận file `keys-backup.json` sau mỗi lần bạn tạo hoặc cập nhật key.

---

## 📁 PHẦN 3: ĐẨY LẠI MÃ NGUỒN MỚI LÊN GITHUB

Toàn bộ các cập nhật:
- Tính năng tự động giữ thức 24/24 (`Anti-Sleep`)
- Nút Sao lưu & Phục hồi trên giao diện Web
- Hỗ trợ Cloud PostgreSQL vĩnh viễn

Đã được đóng gói sẵn sàng để bạn đẩy lên kho GitHub `https://github.com/vinh-2009/SEVER-KEY.git`.
