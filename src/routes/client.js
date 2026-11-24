const express = require('express');
const router = express.Router();
const { KeyModel, LogModel } = require('../database');

/**
 * Trợ giúp trích xuất API Key linh hoạt từ MỌI nguồn:
 * Headers, Query Params, JSON body, URL-encoded body, raw string
 */
function extractApiKey(req) {
  // 1. Headers
  let key = req.headers['x-api-key'] || 
            req.headers['apikey'] || 
            req.headers['api-key'] || 
            req.headers['key'] || 
            req.headers['license-key'] ||
            req.headers['x-license-key'];

  // 2. Authorization Header (Bearer <token> hoặc token trực tiếp)
  if (!key && req.headers.authorization) {
    key = req.headers.authorization.replace(/^Bearer\s+/i, '').trim();
  }

  // 3. Query string (?key=... &apiKey=... &api_key=... &license=...)
  if (!key && req.query) {
    key = req.query.apiKey || req.query.api_key || req.query.key || 
          req.query.license || req.query.licenseKey || req.query.license_key ||
          req.query.Key || req.query.ApiKey;
  }

  // 4. Request Body
  if (!key && req.body) {
    if (typeof req.body === 'string') {
      try {
        const parsed = JSON.parse(req.body);
        key = parsed.apiKey || parsed.api_key || parsed.key || parsed.license || parsed.licenseKey || parsed.license_key;
      } catch {
        if (req.body.trim().length >= 4 && req.body.trim().length <= 100) {
          key = req.body.trim();
        }
      }
    } else if (typeof req.body === 'object') {
      key = req.body.apiKey || req.body.api_key || req.body.key || 
            req.body.license || req.body.licenseKey || req.body.license_key ||
            req.body.Key || req.body.ApiKey;
    }
  }

  return (key && typeof key === 'string') ? key.trim() : null;
}

/**
 * Trợ giúp trích xuất mã thiết bị (HWID)
 */
function extractHwid(req) {
  let hwid = req.headers['x-hwid'] || req.headers['hwid'] || 
             req.headers['device-id'] || req.headers['x-device-id'];

  if (!hwid && req.query) {
    hwid = req.query.hwid || req.query.deviceId || req.query.device_id || 
           req.query.machineId || req.query.machine_id;
  }

  if (!hwid && req.body && typeof req.body === 'object') {
    hwid = req.body.hwid || req.body.deviceId || req.body.device_id || 
           req.body.machineId || req.body.machine_id || req.body.Hwid || req.body.HWID;
  }

  return (hwid && typeof hwid === 'string') ? hwid.trim() : (hwid ? String(hwid).trim() : null);
}

/**
 * Trợ giúp tính số ngày còn lại
 */
function getDaysRemaining(expiresAt) {
  if (!expiresAt) return null; // Vĩnh viễn
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Health check
 */
router.all('/ping', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Server Key & API Auth hoạt động bình thường',
    time: new Date().toISOString()
  });
});

/**
 * Logic xử lý xác thực Key
 * Hỗ trợ CẢ GET LẪN POST, PUT
 */
function handleVerify(req, res) {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const apiKey = extractApiKey(req);
  const clientHwid = extractHwid(req);

  // 1. Kiểm tra có truyền key không
  if (!apiKey) {
    LogModel.create({
      action: 'verify',
      hwid: clientHwid,
      ip,
      status: 'failed',
      message: 'Không tìm thấy API Key trong Header, Query hoặc Body'
    });
    return res.status(400).json({
      valid: false,
      code: 'MISSING_API_KEY',
      message: 'Không tìm thấy API Key! Vui lòng truyền key qua body {"apiKey": "..."}, query "?key=...", hoặc header "x-api-key".',
      receivedParams: {
        body: req.body,
        query: req.query,
        headersChecked: ['x-api-key', 'apikey', 'authorization', 'key']
      }
    });
  }

  const cleanKey = apiKey.trim();
  const keyRecord = KeyModel.getByString(cleanKey);

  // 2. Kiểm tra key có tồn tại trong database không
  if (!keyRecord) {
    LogModel.create({
      keyString: cleanKey,
      action: 'verify',
      hwid: clientHwid,
      ip,
      status: 'failed',
      message: `Key "${cleanKey}" không tồn tại`
    });
    return res.status(401).json({
      valid: false,
      code: 'INVALID_KEY',
      message: `API Key "${cleanKey}" không tồn tại trên hệ thống`,
      key: cleanKey
    });
  }

  // 3. Kiểm tra trạng thái bị khóa
  if (keyRecord.status === 'blocked') {
    LogModel.create({
      keyId: keyRecord.id,
      keyString: cleanKey,
      action: 'verify',
      hwid: clientHwid,
      ip,
      status: 'failed',
      message: 'Key đã bị Admin khóa'
    });
    return res.status(403).json({
      valid: false,
      code: 'KEY_BLOCKED',
      message: 'API Key này đã bị khóa hoặc tạm dừng hoạt động. Vui lòng liên hệ Admin.',
      key: cleanKey
    });
  }

  // 4. Kiểm tra hạn dùng
  if (keyRecord.expires_at) {
    const expDate = new Date(keyRecord.expires_at);
    if (new Date() > expDate) {
      if (keyRecord.status !== 'expired') {
        KeyModel.update(keyRecord.id, { status: 'expired' });
      }
      LogModel.create({
        keyId: keyRecord.id,
        keyString: cleanKey,
        action: 'verify',
        hwid: clientHwid,
        ip,
        status: 'failed',
        message: 'Key đã hết hạn'
      });
      return res.status(403).json({
        valid: false,
        code: 'KEY_EXPIRED',
        message: 'API Key đã hết hạn sử dụng. Vui lòng gia hạn thêm.',
        expiresAt: keyRecord.expires_at
      });
    }
  }

  // 5. Kiểm tra HWID (Khóa theo máy nếu client gửi hoặc key đã gán)
  if (clientHwid) {
    const cleanHwid = String(clientHwid).trim();
    if (!keyRecord.hwid) {
      // Tự động liên kết HWID vào key trong lần đầu tiên sử dụng!
      KeyModel.recordUse(keyRecord.id, cleanHwid);
      keyRecord.hwid = cleanHwid;
    } else if (keyRecord.hwid.toLowerCase() !== cleanHwid.toLowerCase()) {
      LogModel.create({
        keyId: keyRecord.id,
        keyString: cleanKey,
        action: 'verify',
        hwid: cleanHwid,
        ip,
        status: 'failed',
        message: `Mã máy không khớp (Key thuộc máy: ${keyRecord.hwid})`
      });
      return res.status(403).json({
        valid: false,
        code: 'DEVICE_MISMATCH',
        message: 'Key này đã được kích hoạt trên thiết bị khác! Vui lòng liên hệ Admin để reset mã máy.',
        registeredHwid: keyRecord.hwid.slice(0, 8) + '...'
      });
    }
  }

  // Cập nhật lượt dùng
  KeyModel.recordUse(keyRecord.id, clientHwid);

  LogModel.create({
    keyId: keyRecord.id,
    keyString: cleanKey,
    action: 'verify',
    hwid: clientHwid || keyRecord.hwid,
    ip,
    status: 'success',
    message: 'Xác thực thành công'
  });

  const daysRemaining = getDaysRemaining(keyRecord.expires_at);

  return res.json({
    valid: true,
    status: 'active',
    key: keyRecord.key,
    name: keyRecord.name,
    isLifetime: !keyRecord.expires_at,
    expiresAt: keyRecord.expires_at,
    daysRemaining,
    hwid: keyRecord.hwid,
    serverTime: new Date().toISOString()
  });
}

// Gắn routes xác thực với nhiều bí danh để tránh lỗi sai đường dẫn
router.all('/verify', handleVerify);
router.all('/check', handleVerify);
router.all('/validate', handleVerify);

/**
 * Endpoint kích hoạt thiết bị tường minh
 */
router.all('/activate', (req, res) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const apiKey = extractApiKey(req);
  const clientHwid = extractHwid(req);

  if (!apiKey || !clientHwid) {
    return res.status(400).json({
      success: false,
      code: 'MISSING_PARAMS',
      message: 'Cần truyền đầy đủ apiKey và hwid'
    });
  }

  const cleanKey = apiKey.trim();
  const cleanHwid = String(clientHwid).trim();
  const keyRecord = KeyModel.getByString(cleanKey);

  if (!keyRecord) {
    return res.status(404).json({
      success: false,
      code: 'INVALID_KEY',
      message: 'Key không tồn tại'
    });
  }

  if (keyRecord.status === 'blocked') {
    return res.status(403).json({
      success: false,
      code: 'KEY_BLOCKED',
      message: 'Key đã bị khóa'
    });
  }

  // Nếu key đã liên kết máy khác
  if (keyRecord.hwid && keyRecord.hwid.toLowerCase() !== cleanHwid.toLowerCase()) {
    return res.status(403).json({
      success: false,
      code: 'DEVICE_ALREADY_BOUND',
      message: 'Key này đã được kích hoạt trên một thiết bị khác!'
    });
  }

  // Kích hoạt thiết bị
  KeyModel.recordUse(keyRecord.id, cleanHwid);

  LogModel.create({
    keyId: keyRecord.id,
    keyString: cleanKey,
    action: 'activate',
    hwid: cleanHwid,
    ip,
    status: 'success',
    message: 'Kích hoạt máy thành công'
  });

  return res.json({
    success: true,
    message: 'Kích hoạt thiết bị thành công cho Key',
    key: keyRecord.key,
    hwid: cleanHwid,
    expiresAt: keyRecord.expires_at,
    daysRemaining: getDaysRemaining(keyRecord.expires_at)
  });
});

/**
 * Endpoint Demo bảo vệ dữ liệu bằng API Key
 */
router.all('/protected-data', (req, res) => {
  const apiKey = extractApiKey(req);
  if (!apiKey) {
    return res.status(401).json({ error: 'Chưa có API Key' });
  }

  const keyRecord = KeyModel.getByString(apiKey.trim());
  if (!keyRecord || keyRecord.status !== 'active') {
    return res.status(403).json({ error: 'Key không hợp lệ hoặc đã hết hạn' });
  }

  res.json({
    success: true,
    welcome: `Xin chào ${keyRecord.name}!`,
    serverSecretData: {
      appName: 'Super Cool App',
      appVersion: '2.5.0',
      featuresUnlocked: ['premium_feature_1', 'auto_bot_pro', 'unlimited_export'],
      downloadMirror: 'https://example.com/downloads/latest-tool.zip'
    }
  });
});

module.exports = router;
