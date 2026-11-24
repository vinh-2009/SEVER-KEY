const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const crypto = require('node:crypto');

const DB_PATH = path.join(__dirname, '..', 'keys.db');
const db = new DatabaseSync(DB_PATH);

// Khởi tạo bảng nếu chưa có
db.exec(`
  CREATE TABLE IF NOT EXISTS keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    hwid TEXT DEFAULT NULL,
    max_devices INTEGER DEFAULT 1,
    expires_at TEXT DEFAULT NULL,
    note TEXT DEFAULT '',
    total_requests INTEGER DEFAULT 0,
    last_used_at TEXT DEFAULT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_id INTEGER,
    key_string TEXT,
    action TEXT NOT NULL,
    hwid TEXT,
    ip TEXT,
    status TEXT NOT NULL,
    message TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_keys_key ON keys(key);
  CREATE INDEX IF NOT EXISTS idx_logs_created ON access_logs(created_at);
`);

/**
 * Sinh chuỗi key ngẫu nhiên an toàn
 * Dạng: PREFIX-XXXX-XXXX-XXXX
 */
function generateKeyString(prefix = 'KEY') {
  const p = (prefix || 'KEY').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const part1 = crypto.randomBytes(3).toString('hex').toUpperCase();
  const part2 = crypto.randomBytes(3).toString('hex').toUpperCase();
  const part3 = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${p || 'KEY'}-${part1}-${part2}-${part3}`;
}

const KeyModel = {
  // Lấy danh sách key (hỗ trợ tìm kiếm)
  getAll(search = '', status = 'all') {
    let query = 'SELECT * FROM keys WHERE 1=1';
    const params = [];

    if (search && typeof search === 'string') {
      query += ' AND (name LIKE ? OR key LIKE ? OR note LIKE ? OR hwid LIKE ?)';
      const s = `%${search.trim()}%`;
      params.push(s, s, s, s);
    }

    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY id DESC';
    return db.prepare(query).all(...params);
  },

  getById(id) {
    if (!id) return null;
    return db.prepare('SELECT * FROM keys WHERE id = ?').get(Number(id));
  },

  getByString(keyString) {
    if (!keyString || typeof keyString !== 'string') return null;
    return db.prepare('SELECT * FROM keys WHERE key = ? COLLATE NOCASE').get(keyString.trim());
  },

  create({ name, durationDays, maxDevices = 1, prefix = 'KEY', note = '', customKey = null }) {
    const safeName = (name && typeof name === 'string' && name.trim()) 
      ? name.trim() 
      : `Khách hàng #${Math.floor(1000 + Math.random() * 9000)}`;

    const safePrefix = (prefix && typeof prefix === 'string' && prefix.trim()) 
      ? prefix.trim().toUpperCase() 
      : 'KEY';

    const safeNote = (note && typeof note === 'string') ? note.trim() : '';

    const key = (customKey && typeof customKey === 'string' && customKey.trim()) 
      ? customKey.trim().toUpperCase() 
      : generateKeyString(safePrefix);

    // Kiểm tra xem key đã tồn tại chưa
    const existing = this.getByString(key);
    if (existing) {
      throw new Error(`Mã Key "${key}" đã tồn tại trên hệ thống! Vui lòng chọn mã khác.`);
    }

    const now = new Date();
    const createdAt = now.toISOString();

    let expiresAt = null;
    if (durationDays !== null && durationDays !== undefined && durationDays !== '') {
      const days = Number(durationDays);
      if (!isNaN(days) && days > 0) {
        const exp = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
        expiresAt = exp.toISOString();
      }
    }

    const stmt = db.prepare(`
      INSERT INTO keys (key, name, status, hwid, max_devices, expires_at, note, total_requests, created_at)
      VALUES (?, ?, 'active', NULL, ?, ?, ?, 0, ?)
    `);

    stmt.run(key, safeName, Number(maxDevices) || 1, expiresAt, safeNote, createdAt);
    return this.getByString(key);
  },

  update(id, { name, status, note, maxDevices, expiresAt }) {
    const current = this.getById(id);
    if (!current) return null;

    const newName = name !== undefined ? String(name).trim() : current.name;
    const newStatus = status !== undefined ? String(status).trim() : current.status;
    const newNote = note !== undefined ? String(note).trim() : current.note;
    const newMaxDevices = maxDevices !== undefined ? (Number(maxDevices) || 1) : current.max_devices;
    const newExpiresAt = expiresAt !== undefined ? expiresAt : current.expires_at;

    db.prepare(`
      UPDATE keys
      SET name = ?, status = ?, note = ?, max_devices = ?, expires_at = ?
      WHERE id = ?
    `).run(newName, newStatus, newNote, newMaxDevices, newExpiresAt, Number(id));

    return this.getById(id);
  },

  // Gia hạn thêm số ngày
  extendDays(id, days) {
    const current = this.getById(id);
    if (!current) return null;

    let baseTime = new Date();
    if (current.expires_at) {
      const curExp = new Date(current.expires_at);
      if (curExp > baseTime) {
        baseTime = curExp; // Nếu chưa hết hạn thì cộng nối tiếp từ ngày hết hạn
      }
    }

    const newExp = new Date(baseTime.getTime() + (Number(days) || 30) * 24 * 60 * 60 * 1000).toISOString();
    db.prepare(`
      UPDATE keys
      SET expires_at = ?, status = 'active'
      WHERE id = ?
    `).run(newExp, Number(id));

    return this.getById(id);
  },

  resetHwid(id) {
    db.prepare(`UPDATE keys SET hwid = NULL WHERE id = ?`).run(Number(id));
    return this.getById(id);
  },

  delete(id) {
    return db.prepare('DELETE FROM keys WHERE id = ?').run(Number(id));
  },

  // Ghi nhận lượt sử dụng và cập nhật HWID nếu kích hoạt lần đầu
  recordUse(keyId, hwid) {
    const now = new Date().toISOString();
    if (hwid) {
      db.prepare(`
        UPDATE keys
        SET total_requests = total_requests + 1,
            last_used_at = ?,
            hwid = COALESCE(hwid, ?)
        WHERE id = ?
      `).run(now, String(hwid).trim(), Number(keyId));
    } else {
      db.prepare(`
        UPDATE keys
        SET total_requests = total_requests + 1,
            last_used_at = ?
        WHERE id = ?
      `).run(now, Number(keyId));
    }
  },

  getStats() {
    const totalKeys = db.prepare('SELECT COUNT(*) as count FROM keys').get().count;
    const activeKeys = db.prepare("SELECT COUNT(*) as count FROM keys WHERE status = 'active'").get().count;
    const blockedKeys = db.prepare("SELECT COUNT(*) as count FROM keys WHERE status = 'blocked'").get().count;
    const totalRequests = db.prepare('SELECT SUM(total_requests) as sum FROM keys').get().sum || 0;

    return {
      totalKeys,
      activeKeys,
      blockedKeys,
      totalRequests,
    };
  }
};

const LogModel = {
  create({ keyId = null, keyString = null, action, hwid = null, ip = null, status, message = '' }) {
    try {
      const createdAt = new Date().toISOString();
      db.prepare(`
        INSERT INTO access_logs (key_id, key_string, action, hwid, ip, status, message, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(keyId, keyString, action, hwid ? String(hwid) : null, ip ? String(ip) : null, status, message, createdAt);
    } catch (e) {
      console.error('Lỗi ghi log:', e);
    }
  },

  getRecent(limit = 50) {
    return db.prepare('SELECT * FROM access_logs ORDER BY id DESC LIMIT ?').all(Number(limit) || 50);
  }
};

module.exports = {
  db,
  KeyModel,
  LogModel,
};
