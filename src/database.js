const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const BACKUP_FILE = path.join(__dirname, '..', 'keys-backup.json');
const SEED_FILE = path.join(__dirname, 'keys-seed.json');
const DATABASE_URL = process.env.DATABASE_URL;

let isPostgres = false;
let pgPool = null;
let sqliteDb = null;

// Kiểm tra xem có sử dụng Cloud PostgreSQL (Render / Neon / Supabase) hay không
if (DATABASE_URL && (DATABASE_URL.startsWith('postgres://') || DATABASE_URL.startsWith('postgresql://'))) {
  isPostgres = true;
  const { Pool } = require('pg');
  pgPool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
  });
  console.log('✅ Đang sử dụng Cloud PostgreSQL Database (Dữ liệu vĩnh viễn không bao giờ mất)');
} else {
  const { DatabaseSync } = require('node:sqlite');
  const DB_PATH = path.join(__dirname, '..', 'keys.db');
  sqliteDb = new DatabaseSync(DB_PATH);
  console.log('✅ Đang sử dụng SQLite Database cục bộ (keys.db)');
}

/**
 * Tự động đồng bộ ra cả file backup và file seed
 */
function syncBackupFile(keys) {
  try {
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(keys, null, 2), 'utf8');
    fs.writeFileSync(SEED_FILE, JSON.stringify(keys, null, 2), 'utf8');
  } catch (err) {
    console.error('[Backup] Không thể ghi file backup:', err.message);
  }
}

/**
 * Tự động nạp toàn bộ key đã tạo trước đó vào hệ thống
 */
async function autoSeedKeys() {
  const fileToLoad = fs.existsSync(SEED_FILE) ? SEED_FILE : (fs.existsSync(BACKUP_FILE) ? BACKUP_FILE : null);
  if (!fileToLoad) return;

  try {
    const content = fs.readFileSync(fileToLoad, 'utf8');
    const keys = JSON.parse(content);
    if (Array.isArray(keys) && keys.length > 0) {
      console.log(`[Auto-Seed] Đang tự động kiểm tra và nạp ${keys.length} key đã tạo trước đó...`);
      let loaded = 0;
      for (const item of keys) {
        if (!item.key) continue;
        const existing = await KeyModel.getByString(item.key);
        if (!existing) {
          if (isPostgres) {
            await pgPool.query(`
              INSERT INTO keys (key, name, status, hwid, max_devices, expires_at, note, total_requests, created_at, last_used_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
              ON CONFLICT (key) DO NOTHING
            `, [item.key, item.name || 'User', item.status || 'active', item.hwid || null, item.max_devices || 1, item.expires_at || null, item.note || '', item.total_requests || 0, item.created_at || new Date().toISOString(), item.last_used_at || null]);
          } else {
            sqliteDb.prepare(`
              INSERT OR IGNORE INTO keys (key, name, status, hwid, max_devices, expires_at, note, total_requests, created_at, last_used_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(item.key, item.name || 'User', item.status || 'active', item.hwid || null, item.max_devices || 1, item.expires_at || null, item.note || '', item.total_requests || 0, item.created_at || new Date().toISOString(), item.last_used_at || null);
          }
          loaded++;
        }
      }
      if (loaded > 0) {
        console.log(`[Auto-Seed] Đã tự động nạp thành công ${loaded} key đã tạo trước đó vào Database!`);
      }
    }
  } catch (err) {
    console.error('[Auto-Seed] Lỗi khi nạp key seed:', err.message);
  }
}

/**
 * Khởi tạo bảng dữ liệu
 */
async function initDatabase() {
  if (isPostgres) {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS keys (
        id SERIAL PRIMARY KEY,
        key VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'active',
        hwid VARCHAR(255) DEFAULT NULL,
        max_devices INTEGER DEFAULT 1,
        expires_at TIMESTAMPTZ DEFAULT NULL,
        note TEXT DEFAULT '',
        total_requests INTEGER DEFAULT 0,
        last_used_at TIMESTAMPTZ DEFAULT NULL,
        created_at TIMESTAMPTZ NOT NULL
      );

      CREATE TABLE IF NOT EXISTS access_logs (
        id SERIAL PRIMARY KEY,
        key_id INTEGER,
        key_string VARCHAR(255),
        action VARCHAR(50) NOT NULL,
        hwid VARCHAR(255),
        ip VARCHAR(100),
        status VARCHAR(50) NOT NULL,
        message TEXT,
        created_at TIMESTAMPTZ NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_keys_key ON keys(key);
      CREATE INDEX IF NOT EXISTS idx_logs_created ON access_logs(created_at);
    `);
  } else {
    sqliteDb.exec(`
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
  }

  // TỰ ĐỘNG NẠP LẠI TOÀN BỘ KEY ĐÃ TẠO TRƯỚC ĐÓ VÀO DATABASE
  await autoSeedKeys();
}

function generateKeyString(prefix = 'KEY') {
  const p = (prefix || 'KEY').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const part1 = crypto.randomBytes(3).toString('hex').toUpperCase();
  const part2 = crypto.randomBytes(3).toString('hex').toUpperCase();
  const part3 = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${p || 'KEY'}-${part1}-${part2}-${part3}`;
}

const KeyModel = {
  async getAll(search = '', status = 'all') {
    if (isPostgres) {
      let query = 'SELECT * FROM keys WHERE 1=1';
      const params = [];
      if (search && typeof search === 'string') {
        const s = `%${search.trim()}%`;
        params.push(s, s, s, s);
        query += ` AND (name ILIKE $${params.length - 3} OR key ILIKE $${params.length - 2} OR note ILIKE $${params.length - 1} OR hwid ILIKE $${params.length})`;
      }
      if (status && status !== 'all') {
        params.push(status);
        query += ` AND status = $${params.length}`;
      }
      query += ' ORDER BY id DESC';
      const res = await pgPool.query(query, params);
      return res.rows;
    } else {
      let query = 'SELECT * FROM keys WHERE 1=1';
      const params = [];
      if (search && typeof search === 'string') {
        const s = `%${search.trim()}%`;
        query += ' AND (name LIKE ? OR key LIKE ? OR note LIKE ? OR hwid LIKE ?)';
        params.push(s, s, s, s);
      }
      if (status && status !== 'all') {
        query += ' AND status = ?';
        params.push(status);
      }
      query += ' ORDER BY id DESC';
      return sqliteDb.prepare(query).all(...params);
    }
  },

  async getById(id) {
    if (!id) return null;
    if (isPostgres) {
      const res = await pgPool.query('SELECT * FROM keys WHERE id = $1', [Number(id)]);
      return res.rows[0] || null;
    } else {
      return sqliteDb.prepare('SELECT * FROM keys WHERE id = ?').get(Number(id));
    }
  },

  async getByString(keyString) {
    if (!keyString || typeof keyString !== 'string') return null;
    const clean = keyString.trim();
    if (isPostgres) {
      const res = await pgPool.query('SELECT * FROM keys WHERE LOWER(key) = LOWER($1)', [clean]);
      return res.rows[0] || null;
    } else {
      return sqliteDb.prepare('SELECT * FROM keys WHERE key = ? COLLATE NOCASE').get(clean);
    }
  },

  async create({ name, durationDays, maxDevices = 1, prefix = 'KEY', note = '', customKey = null }) {
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

    const existing = await this.getByString(key);
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

    if (isPostgres) {
      const res = await pgPool.query(`
        INSERT INTO keys (key, name, status, hwid, max_devices, expires_at, note, total_requests, created_at)
        VALUES ($1, $2, 'active', NULL, $3, $4, $5, 0, $6)
        RETURNING *
      `, [key, safeName, Number(maxDevices) || 1, expiresAt, safeNote, createdAt]);
      const created = res.rows[0];
      const all = await this.getAll();
      syncBackupFile(all);
      return created;
    } else {
      sqliteDb.prepare(`
        INSERT INTO keys (key, name, status, hwid, max_devices, expires_at, note, total_requests, created_at)
        VALUES (?, ?, 'active', NULL, ?, ?, ?, 0, ?)
      `).run(key, safeName, Number(maxDevices) || 1, expiresAt, safeNote, createdAt);

      const created = await this.getByString(key);
      const all = await this.getAll();
      syncBackupFile(all);
      return created;
    }
  },

  async update(id, { name, status, note, maxDevices, expiresAt }) {
    const current = await this.getById(id);
    if (!current) return null;

    const newName = name !== undefined ? String(name).trim() : current.name;
    const newStatus = status !== undefined ? String(status).trim() : current.status;
    const newNote = note !== undefined ? String(note).trim() : current.note;
    const newMaxDevices = maxDevices !== undefined ? (Number(maxDevices) || 1) : current.max_devices;
    const newExpiresAt = expiresAt !== undefined ? expiresAt : current.expires_at;

    if (isPostgres) {
      const res = await pgPool.query(`
        UPDATE keys
        SET name = $1, status = $2, note = $3, max_devices = $4, expires_at = $5
        WHERE id = $6
        RETURNING *
      `, [newName, newStatus, newNote, newMaxDevices, newExpiresAt, Number(id)]);
      const all = await this.getAll();
      syncBackupFile(all);
      return res.rows[0];
    } else {
      sqliteDb.prepare(`
        UPDATE keys
        SET name = ?, status = ?, note = ?, max_devices = ?, expires_at = ?
        WHERE id = ?
      `).run(newName, newStatus, newNote, newMaxDevices, newExpiresAt, Number(id));

      const updated = await this.getById(id);
      const all = await this.getAll();
      syncBackupFile(all);
      return updated;
    }
  },

  async extendDays(id, days) {
    const current = await this.getById(id);
    if (!current) return null;

    let baseTime = new Date();
    if (current.expires_at) {
      const curExp = new Date(current.expires_at);
      if (curExp > baseTime) {
        baseTime = curExp;
      }
    }

    const newExp = new Date(baseTime.getTime() + (Number(days) || 30) * 24 * 60 * 60 * 1000).toISOString();

    if (isPostgres) {
      const res = await pgPool.query(`
        UPDATE keys
        SET expires_at = $1, status = 'active'
        WHERE id = $2
        RETURNING *
      `, [newExp, Number(id)]);
      const all = await this.getAll();
      syncBackupFile(all);
      return res.rows[0];
    } else {
      sqliteDb.prepare(`
        UPDATE keys
        SET expires_at = ?, status = 'active'
        WHERE id = ?
      `).run(newExp, Number(id));

      const updated = await this.getById(id);
      const all = await this.getAll();
      syncBackupFile(all);
      return updated;
    }
  },

  async resetHwid(id) {
    if (isPostgres) {
      const res = await pgPool.query('UPDATE keys SET hwid = NULL WHERE id = $1 RETURNING *', [Number(id)]);
      const all = await this.getAll();
      syncBackupFile(all);
      return res.rows[0];
    } else {
      sqliteDb.prepare('UPDATE keys SET hwid = NULL WHERE id = ?').run(Number(id));
      const updated = await this.getById(id);
      const all = await this.getAll();
      syncBackupFile(all);
      return updated;
    }
  },

  async delete(id) {
    if (isPostgres) {
      await pgPool.query('DELETE FROM keys WHERE id = $1', [Number(id)]);
    } else {
      sqliteDb.prepare('DELETE FROM keys WHERE id = ?').run(Number(id));
    }
    const all = await this.getAll();
    syncBackupFile(all);
    return true;
  },

  async recordUse(keyId, hwid) {
    const now = new Date().toISOString();
    if (isPostgres) {
      if (hwid) {
        await pgPool.query(`
          UPDATE keys
          SET total_requests = total_requests + 1,
              last_used_at = $1,
              hwid = COALESCE(hwid, $2)
          WHERE id = $3
        `, [now, String(hwid).trim(), Number(keyId)]);
      } else {
        await pgPool.query(`
          UPDATE keys
          SET total_requests = total_requests + 1,
              last_used_at = $1
          WHERE id = $2
        `, [now, Number(keyId)]);
      }
    } else {
      if (hwid) {
        sqliteDb.prepare(`
          UPDATE keys
          SET total_requests = total_requests + 1,
              last_used_at = ?,
              hwid = COALESCE(hwid, ?)
          WHERE id = ?
        `).run(now, String(hwid).trim(), Number(keyId));
      } else {
        sqliteDb.prepare(`
          UPDATE keys
          SET total_requests = total_requests + 1,
              last_used_at = ?
          WHERE id = ?
        `).run(now, Number(keyId));
      }
    }
  },

  async getStats() {
    if (isPostgres) {
      const t = await pgPool.query('SELECT COUNT(*) as count FROM keys');
      const a = await pgPool.query("SELECT COUNT(*) as count FROM keys WHERE status = 'active'");
      const b = await pgPool.query("SELECT COUNT(*) as count FROM keys WHERE status = 'blocked'");
      const r = await pgPool.query('SELECT SUM(total_requests) as sum FROM keys');

      return {
        databaseType: 'PostgreSQL (Cloud Persistent)',
        totalKeys: parseInt(t.rows[0].count) || 0,
        activeKeys: parseInt(a.rows[0].count) || 0,
        blockedKeys: parseInt(b.rows[0].count) || 0,
        totalRequests: parseInt(r.rows[0].sum) || 0,
      };
    } else {
      const totalKeys = sqliteDb.prepare('SELECT COUNT(*) as count FROM keys').get().count;
      const activeKeys = sqliteDb.prepare("SELECT COUNT(*) as count FROM keys WHERE status = 'active'").get().count;
      const blockedKeys = sqliteDb.prepare("SELECT COUNT(*) as count FROM keys WHERE status = 'blocked'").get().count;
      const totalRequests = sqliteDb.prepare('SELECT SUM(total_requests) as sum FROM keys').get().sum || 0;

      return {
        databaseType: 'SQLite (Tự Động Nạp Seed & Backup)',
        totalKeys,
        activeKeys,
        blockedKeys,
        totalRequests,
      };
    }
  },

  async restoreFromData(keysList) {
    if (!Array.isArray(keysList)) throw new Error('Dữ liệu khôi phục không hợp lệ');

    let count = 0;
    for (const item of keysList) {
      if (!item.key) continue;
      const existing = await this.getByString(item.key);
      if (existing) {
        await this.update(existing.id, {
          name: item.name,
          status: item.status,
          hwid: item.hwid,
          note: item.note,
          maxDevices: item.max_devices,
          expiresAt: item.expires_at
        });
      } else {
        if (isPostgres) {
          await pgPool.query(`
            INSERT INTO keys (key, name, status, hwid, max_devices, expires_at, note, total_requests, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [item.key, item.name || 'User', item.status || 'active', item.hwid || null, item.max_devices || 1, item.expires_at || null, item.note || '', item.total_requests || 0, item.created_at || new Date().toISOString()]);
        } else {
          sqliteDb.prepare(`
            INSERT INTO keys (key, name, status, hwid, max_devices, expires_at, note, total_requests, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(item.key, item.name || 'User', item.status || 'active', item.hwid || null, item.max_devices || 1, item.expires_at || null, item.note || '', item.total_requests || 0, item.created_at || new Date().toISOString());
        }
      }
      count++;
    }

    const all = await this.getAll();
    syncBackupFile(all);

    return count;
  }
};

const LogModel = {
  async create({ keyId = null, keyString = null, action, hwid = null, ip = null, status, message = '' }) {
    try {
      const createdAt = new Date().toISOString();
      if (isPostgres) {
        await pgPool.query(`
          INSERT INTO access_logs (key_id, key_string, action, hwid, ip, status, message, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [keyId, keyString, action, hwid ? String(hwid) : null, ip ? String(ip) : null, status, message, createdAt]);
      } else {
        sqliteDb.prepare(`
          INSERT INTO access_logs (key_id, key_string, action, hwid, ip, status, message, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(keyId, keyString, action, hwid ? String(hwid) : null, ip ? String(ip) : null, status, message, createdAt);
      }
    } catch (e) {
      console.error('Lỗi ghi log:', e);
    }
  },

  async getRecent(limit = 50) {
    if (isPostgres) {
      const res = await pgPool.query('SELECT * FROM access_logs ORDER BY id DESC LIMIT $1', [Number(limit) || 50]);
      return res.rows;
    } else {
      return sqliteDb.prepare('SELECT * FROM access_logs ORDER BY id DESC LIMIT ?').all(Number(limit) || 50);
    }
  }
};

// Khởi chạy khởi tạo database
initDatabase().catch(err => console.error('Lỗi khởi tạo Database:', err));

module.exports = {
  isPostgres,
  KeyModel,
  LogModel,
};
