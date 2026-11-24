/**
 * MẪU CODE JAVASCRIPT / NODE.JS / REACT NATIVE / ELECTRON
 * Dùng để xác thực API Key
 */

const SERVER_URL = 'http://localhost:3000/api/v1/verify';

async function checkApiKey(apiKey, hwid = null) {
  try {
    const res = await fetch(SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: apiKey.trim(),
        hwid: hwid || 'DEVICE_DEV_123'
      })
    });

    const data = await res.json();
    if (res.ok && data.valid) {
      console.log('✅ Key hợp lệ!');
      console.log('Khách hàng:', data.name);
      console.log('Còn lại:', data.daysRemaining !== null ? `${data.daysRemaining} ngày` : 'Vĩnh viễn');
      return { success: true, data };
    } else {
      console.error('❌ Lỗi:', data.message || 'Key không hợp lệ');
      return { success: false, error: data.message };
    }
  } catch (error) {
    console.error('⚠️ Không thể kết nối tới server:', error.message);
    return { success: false, error: 'Lỗi mạng' };
  }
}

// Chạy thử kiểm tra
const testKey = 'KEY-TEST-DEMO';
checkApiKey(testKey);
