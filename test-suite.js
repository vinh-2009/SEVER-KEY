const { app, server } = require('./src/server');
const http = require('node:http');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;
const ADMIN_TOKEN = 'admin_secret_key_123';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, options);
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function runTests() {
  console.log('--- BẮT ĐẦU KIỂM THỬ SERVER KEY ---');

  // 1. Test Ping
  console.log('1. Kiểm tra /api/v1/ping...');
  const ping = await request('/api/v1/ping');
  console.assert(ping.status === 200 && ping.data.status === 'ok', 'Ping failed');
  console.log('   => [OK] Ping thành công:', ping.data.message);

  // 2. Test Admin Stats
  console.log('2. Kiểm tra /api/admin/stats...');
  const stats = await request('/api/admin/stats', {
    headers: { 'x-admin-token': ADMIN_TOKEN }
  });
  console.assert(stats.status === 200 && stats.data.success, 'Admin stats failed');
  console.log('   => [OK] Stats:', stats.data.stats);

  // 3. Admin tạo Key mới
  console.log('3. Kiểm tra Admin tạo Key 30 ngày...');
  const createRes = await request('/api/admin/keys', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': ADMIN_TOKEN
    },
    body: JSON.stringify({
      name: 'Nguyen Van Test',
      durationDays: 30,
      prefix: 'VIP',
      note: 'Don hang #101'
    })
  });
  console.assert(createRes.status === 201 && createRes.data.key, 'Create key failed');
  const myKey = createRes.data.key.key;
  const keyId = createRes.data.key.id;
  console.log(`   => [OK] Đã tạo Key: ${myKey} (ID: ${keyId})`);

  // 4. Client verify lần 1 kèm HWID máy 1
  console.log('4. Kiểm tra Client App Verify lần đầu với HWID: PC_DEV_01...');
  const verify1 = await request('/api/v1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: myKey,
      hwid: 'PC_DEV_01'
    })
  });
  console.assert(verify1.status === 200 && verify1.data.valid, 'Verify 1 failed');
  console.log('   => [OK] Verify thành công, tự gán HWID:', verify1.data.hwid);

  // 5. Client verify từ máy khác (HWID mismatch)
  console.log('5. Kiểm tra Client App khác dùng chung Key với HWID: PC_DEV_02...');
  const verifyWrongHwid = await request('/api/v1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: myKey,
      hwid: 'PC_DEV_02'
    })
  });
  console.assert(verifyWrongHwid.status === 403 && verifyWrongHwid.data.code === 'DEVICE_MISMATCH', 'Device mismatch check failed');
  console.log('   => [OK] Chặn thành công thiết bị lạ:', verifyWrongHwid.data.message);

  // 6. Admin Reset HWID
  console.log('6. Kiểm tra Admin Reset HWID...');
  const resetRes = await request(`/api/admin/keys/${keyId}/reset-hwid`, {
    method: 'POST',
    headers: { 'x-admin-token': ADMIN_TOKEN }
  });
  console.assert(resetRes.status === 200 && resetRes.data.key.hwid === null, 'Reset HWID failed');
  console.log('   => [OK] Đã reset HWID về null');

  // 7. Client máy 2 kích hoạt lại sau khi Admin reset
  console.log('7. Kiểm tra Client máy PC_DEV_02 kích hoạt sau khi reset...');
  const verify2 = await request('/api/v1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: myKey,
      hwid: 'PC_DEV_02'
    })
  });
  console.assert(verify2.status === 200 && verify2.data.valid, 'Verify 2 failed');
  console.log('   => [OK] Máy PC_DEV_02 đã nhận key mới thành công');

  // 8. Admin khóa Key
  console.log('8. Kiểm tra Admin khóa Key...');
  const blockRes = await request(`/api/admin/keys/${keyId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': ADMIN_TOKEN
    },
    body: JSON.stringify({ status: 'blocked' })
  });
  console.assert(blockRes.status === 200 && blockRes.data.key.status === 'blocked', 'Block key failed');

  // 9. Client verify sau khi bị khóa
  console.log('9. Kiểm tra Client verify key bị khóa...');
  const verifyBlocked = await request('/api/v1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: myKey,
      hwid: 'PC_DEV_02'
    })
  });
  console.assert(verifyBlocked.status === 403 && verifyBlocked.data.code === 'KEY_BLOCKED', 'Blocked check failed');
  console.log('   => [OK] Chặn truy cập key bị khóa thành công:', verifyBlocked.data.message);

  // 10. Mở khóa lại
  await request(`/api/admin/keys/${keyId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': ADMIN_TOKEN
    },
    body: JSON.stringify({ status: 'active' })
  });

  // 11. Kiểm tra Protected Resource
  console.log('10. Kiểm tra truy cập API dữ liệu mật (/api/v1/protected-data)...');
  const protectedData = await request('/api/v1/protected-data', {
    method: 'POST',
    headers: { 'x-api-key': myKey }
  });
  console.assert(protectedData.status === 200 && protectedData.data.success, 'Protected data failed');
  console.log('   => [OK] Dữ liệu mật được trả về an toàn:', protectedData.data.serverSecretData.appName);

  console.log('\n=========================================');
  console.log('🎉 TẤT CẢ 10 BÀI TEST ĐÃ VƯỢT QUA 100%! ');
  console.log('=========================================');

  server.close(() => process.exit(0));
}

runTests().catch(err => {
  console.error('LỖI TEST:', err);
  process.exit(1);
});
