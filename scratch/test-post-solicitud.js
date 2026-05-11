// Test the actual POST /api/entregas/solicitudes endpoint
const http = require('http');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const secret = process.env.JWT_SECRET || 'dev-secret';

// Build a directivo token
const token = jwt.sign(
  { sub: 21, nombre: 'Test', apellido: 'Directivo', email: 'directivo@test.com', role: 'directivo' },
  secret,
  { expiresIn: '1h' }
);

const payload = JSON.stringify({
  id_pedido: 3,
  fecha_retiro: '2026-05-20',
  retira_tipo: 'directivo',
  retira_nombre: null,
  retira_dni: null,
  observaciones: null,
  items: [{ producto_id: 3, cantidad: 1 }]
});

const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/api/entregas/solicitudes',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'Authorization': `Bearer ${token}`
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try {
      console.log('Body:', JSON.stringify(JSON.parse(data), null, 2));
    } catch {
      console.log('Body (raw):', data);
    }
  });
});

req.on('error', e => console.error('Request error:', e.message));
req.write(payload);
req.end();
