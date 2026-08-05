const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '..', 'backend');
const destDir = path.resolve(__dirname, 'backend');

if (fs.existsSync(srcDir)) {
  console.log('Copying backend into frontend/backend for Vercel bundling...');
  try {
    fs.cpSync(srcDir, destDir, { recursive: true });
    console.log('Backend copied successfully.');
  } catch (err) {
    console.error('Error copying backend:', err.message);
  }
}
