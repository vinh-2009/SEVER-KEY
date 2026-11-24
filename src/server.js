const express = require('express');
const cors = require('cors');
const path = require('node:path');
const { PORT, ADMIN_TOKEN } = require('./config');
const clientRoutes = require('./routes/client');
const adminRoutes = require('./routes/admin');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ type: 'text/*' }));

// Phục vụ giao diện Web Dashboard
app.use(express.static(path.join(__dirname, '..', 'public')));

// Gắn routes chính
app.use('/api/v1', clientRoutes);
app.use('/api/admin', adminRoutes);

// Bí danh đường dẫn (Aliases) để app gọi kiểu nào cũng chạy:
// /verify, /check, /api/verify, /api/check đều trỏ vào clientRoutes
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
    console.log(`   🚀 KEY & API LICENSE SERVER ĐANG CHẠY!`);
    console.log(`   🌐 Dashboard Admin: http://localhost:${PORT}`);
    console.log(`   🔑 Token Admin:     ${ADMIN_TOKEN}`);
    console.log(`   🔌 Endpoint verify: http://localhost:${PORT}/api/v1/verify`);
    console.log(`=======================================================`);
  });
}

module.exports = { app, server: serverInstance };
