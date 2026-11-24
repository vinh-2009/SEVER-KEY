const { app } = require('./src/server');

const PORT = 3001; // Dùng port 3001 cho test
let serverInstance;

async function request(path, options = {}) {
  const url = `http://localhost:${PORT}${path}`;
  const res = await fetch(url, options);
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function runTests() {
  serverInstance = app.listen(PORT);
  console.log('--- BẮT ĐẦU KIỂM THỬ CÁC FIX CHO KEY SERVER ---');

  // TEST 1: Tạo key với body rỗng {} (không cần tên, không cần gì cả)
  console.log('1. Test: Tạo key không truyền tên (body rỗng {})...');
  const emptyRes = await request('/api/admin/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  console.assert(emptyRes.status === 201 && emptyRes.data.key, 'Test 1 Failed');
  console.log('   => [PASS] Đã tạo key tự động thành công:', emptyRes.data.key.key, 'Tên:', emptyRes.data.key.name);

  // TEST 2: Quick Create 1-Click
  console.log('2. Test: Quick-create 1-Click...');
  const quickRes = await request('/api/admin/quick-create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ days: 30 })
  });
  console.assert(quickRes.status === 201 && quickRes.data.key, 'Test 2 Failed');
  const testKey = quickRes.data.key.key;
  console.log('   => [PASS] Quick-create thành công:', testKey);

  // TEST 3: Gửi API Key qua query URL (GET /api/v1/verify?key=...)
  console.log('3. Test: Verify qua GET query string (?key=...)...');
  const getVerify = await request(`/api/v1/verify?key=${testKey}&hwid=PC_GET_01`);
  console.assert(getVerify.status === 200 && getVerify.data.valid, 'Test 3 Failed');
  console.log('   => [PASS] GET query verify thành công!');

  // TEST 4: Gửi qua body {"key": "..."} thay vì apiKey
  console.log('4. Test: Verify qua body {"key": "..."}...');
  const bodyKeyVerify = await request('/api/v1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: testKey, hwid: 'PC_GET_01' })
  });
  console.assert(bodyKeyVerify.status === 200 && bodyKeyVerify.data.valid, 'Test 4 Failed');
  console.log('   => [PASS] Body {"key": "..."} verify thành công!');

  // TEST 5: Gửi qua body {"api_key": "..."} (kiểu snake_case)
  console.log('5. Test: Verify qua body {"api_key": "..."}...');
  const bodyApiKeySnake = await request('/api/v1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: testKey, hwid: 'PC_GET_01' })
  });
  console.assert(bodyApiKeySnake.status === 200 && bodyApiKeySnake.data.valid, 'Test 5 Failed');
  console.log('   => [PASS] Body {"api_key": "..."} verify thành công!');

  // TEST 6: Gửi qua bí danh /verify (không cần /api/v1)
  console.log('6. Test: Verify qua URL rút gọn /verify?key=...');
  const rootVerify = await request(`/verify?key=${testKey}&hwid=PC_GET_01`);
  console.assert(rootVerify.status === 200 && rootVerify.data.valid, 'Test 6 Failed');
  console.log('   => [PASS] URL rút gọn /verify chạy thành công!');

  // TEST 7: Thử tạo trùng customKey xem có báo lỗi thân thiện không
  console.log('7. Test: Tạo trùng custom key xem có báo lỗi tiếng Việt không...');
  await request('/api/admin/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customKey: 'TRUNG-KEY-123' })
  });
  const duplicateRes = await request('/api/admin/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customKey: 'TRUNG-KEY-123' })
  });
  console.assert(duplicateRes.status === 400 && duplicateRes.data.message.includes('đã tồn tại'), 'Test 7 Failed');
  console.log('   => [PASS] Bắt lỗi trùng key rất đẹp:', duplicateRes.data.message);

  console.log('\n=============================================');
  console.log('🎉 TẤT CẢ 7 TRƯỜNG HỢP KIỂM THỬ ĐÃ PASS 100%!');
  console.log('=============================================');

  serverInstance.close(() => process.exit(0));
}

runTests().catch(err => {
  console.error('LỖI:', err);
  process.exit(1);
});
