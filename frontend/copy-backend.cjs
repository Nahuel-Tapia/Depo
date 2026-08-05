const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '..', 'backend');
const destDir = path.resolve(__dirname, 'backend');

if (fs.existsSync(srcDir)) {
  console.log('Copying backend into frontend/backend for Vercel bundling...');
  try {
    fs.cpSync(srcDir, destDir, { recursive: true });
    // Garantizar que la carpeta copiada sea tratada como CommonJS por Node.js
    fs.writeFileSync(
      path.join(destDir, 'package.json'),
      JSON.stringify({ type: 'commonjs' }, null, 2)
    );
    console.log('Backend copied and CommonJS package.json created successfully.');
  } catch (err) {
    console.error('Error copying backend:', err.message);
  }
}
