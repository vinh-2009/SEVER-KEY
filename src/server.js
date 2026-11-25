const express = require('express');
const cors = require('cors');
const path = require('node:path');
const { PORT, ADMIN_TOKEN } = require('./config');
const clientRoutes = require('./routes/client');
const adminRoutes = require('./routes/admin');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.text({ type: 'text/*' }));

// Phục vụ giao diện Web Dashboard
app.use(express.static(path.join(__dirname, '..', 'public')));

// Gắn routes chính
app.use('/api/v1', clientRoutes);
app.use('/api/admin', adminRoutes);

// Bí danh đường dẫn (Aliases) để app gọi kiểu nào cũng chạy:
app.use('/api', clientRoutes);
app.use('/', clientRoutes);

// Route Web Admin Dashboard
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Xử lý lỗi 404 cho API không khớp
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint API không tồn tại' });
});

// Khởi chạy server nếu file được chạy trực tiếp
let serverInstance = null;
if (require.main === module) {
  serverInstance = app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`   🚀 KEY & API LICENSE SERVER ĐANG CHẠY 24/24!`);
    console.log(`   🌐 Dashboard Admin: http://localhost:${PORT}`);
    console.log(`   🔑 Token Admin:     ${ADMIN_TOKEN}`);
    console.log(`   🔌 Endpoint verify: http://localhost:${PORT}/api/v1/verify`);
    console.log(`=======================================================`);

    // TÍNH NĂNG TỰ ĐỘNG GIỮ THỨC 24/24 (ANTI-SLEEP CHO RENDER/CLOUD)
    const pingTarget = process.env.RENDER_EXTERNAL_URL || process.env.SERVER_URL || process.env.KEEP_ALIVE_URL;
    if (pingTarget) {
      console.log(`   ⏰ [Anti-Sleep] Kích hoạt tự động Ping 24/24 cho: ${pingTarget}`);
      setInterval(async () => {
        try {
          const res = await fetch(`${pingTarget}/api/v1/ping`);
          const data = await res.json();
          console.log(`   [Anti-Sleep] Ping thành công lúc ${new Date().toLocaleTimeString('vi-VN')}: ${data.status}`);
        } catch (err) {
          console.error(`   [Anti-Sleep] Lỗi ping:`, err.message);
        }
      }, 9 * 60 * 1000); // 9 phút ping 1 lần (Render sleep sau 15 phút)
    }
  });
}

module.exports = { app, server: serverInstance };
