const express = require('express');
const router = express.Router();
const { KeyModel, LogModel } = require('../database');
const { ADMIN_TOKEN } = require('../config');

// Middleware xác thực quyền Admin
function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'] || 
                (req.headers.authorization && req.headers.authorization.replace(/^Bearer\s+/i, '')) ||
                req.query.admin_token ||
                req.query.adminToken ||
                (req.body && (req.body.adminToken || req.body.admin_token));

  const ip = req.ip || req.socket.remoteAddress || '';
  const isLocal = ip.includes('127.0.0.1') || ip.includes('::1') || ip.includes('localhost') || ip === '::ffff:127.0.0.1';

  // Cho phép nếu:
  // 1. Token chính xác
  // 2. Hoặc chạy trực tiếp trên máy nội bộ (localhost) khi chưa set token
  if (token === ADMIN_TOKEN || (isLocal && (!token || token === 'admin_secret_key_123'))) {
    return next();
  }

  return res.status(401).json({
    success: false,
    error: 'UNAUTHORIZED',
    message: `Token quản trị không chính xác! Vui lòng nhập token đúng (Mặc định: ${ADMIN_TOKEN})`
  });
}

router.use(requireAdmin);

// Thống kê tổng quan
router.get('/stats', (req, res) => {
  try {
    const stats = KeyModel.getStats();
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Lấy danh sách Key
router.get('/keys', (req, res) => {
  try {
    const { search = '', status = 'all' } = req.query;
    const keys = KeyModel.getAll(search, status);
    res.json({ success: true, count: keys.length, keys });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Tạo nhanh Key 1-Click (Không cần điền form, tiện lợi tối đa)
router.all('/quick-create', (req, res) => {
  try {
    const durationDays = req.query.days || req.body.days || 30;
    const prefix = req.query.prefix || req.body.prefix || 'VIP';
    const name = req.query.name || req.body.name || `Khách hàng #${Math.floor(1000 + Math.random() * 9000)}`;

    const newKey = KeyModel.create({
      name,
      durationDays: Number(durationDays) || 30,
      prefix,
      note: 'Tạo nhanh 1-Click'
    });

    res.status(201).json({
      success: true,
      message: 'Tạo key thành công!',
      key: newKey,
      apiKey: newKey.key
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Tạo Key mới tiêu chuẩn
router.post('/keys', (req, res) => {
  try {
    const { name, durationDays, maxDevices, prefix, note, customKey, quantity = 1 } = req.body;

    const count = Math.min(Math.max(parseInt(quantity) || 1, 1), 50);
    const createdKeys = [];

    // Parse số ngày: nếu là 0 hoặc "0" thì vĩnh viễn (null), nếu không truyền thì mặc định 30 ngày
    let days = 30;
    if (durationDays !== undefined && durationDays !== null && durationDays !== '') {
      days = Number(durationDays);
    }

    for (let i = 0; i < count; i++) {
      let keyName = name && String(name).trim();
      if (!keyName) {
        keyName = count > 1 ? `Khách hàng #${i + 1}` : `Khách hàng #${Math.floor(1000 + Math.random() * 9000)}`;
      } else if (count > 1) {
        keyName = `${keyName} #${i + 1}`;
      }

      const newKey = KeyModel.create({
        name: keyName,
        durationDays: days,
        maxDevices: maxDevices ? parseInt(maxDevices) : 1,
        prefix: prefix || 'KEY',
        note: note || '',
        customKey: (count === 1 && customKey && customKey.trim()) ? customKey.trim() : null
      });
      createdKeys.push(newKey);
    }

    res.status(201).json({
      success: true,
      message: `Đã tạo thành công ${createdKeys.length} key!`,
      keys: createdKeys,
      key: createdKeys[0],
      apiKey: createdKeys[0].key
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message || 'Lỗi khi tạo key'
    });
  }
});

// Cập nhật key
router.patch('/keys/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updated = KeyModel.update(id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy Key' });
    }
    res.json({ success: true, message: 'Cập nhật Key thành công', key: updated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Gia hạn ngày sử dụng
router.post('/keys/:id/extend', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { days = 30 } = req.body;
    const updated = KeyModel.extendDays(id, days);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy Key' });
    }
    res.json({ success: true, message: `Đã gia hạn thêm ${days} ngày`, key: updated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Reset mã máy (HWID)
router.post('/keys/:id/reset-hwid', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updated = KeyModel.resetHwid(id);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy Key' });
    }
    res.json({ success: true, message: 'Đã reset mã thiết bị HWID thành công', key: updated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Xóa key
router.delete('/keys/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    KeyModel.delete(id);
    res.json({ success: true, message: 'Đã xóa Key thành công' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Xem logs gần nhất
router.get('/logs', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const logs = LogModel.getRecent(limit);
    res.json({ success: true, count: logs.length, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
