require('node:process');

const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'admin_secret_key_123';

module.exports = {
  PORT,
  ADMIN_TOKEN,
  APP_NAME: 'License & API Key Server',
};
