const jwt = require('jsonwebtoken');
const http = require('http');
const https = require('https');

const token = jwt.sign({ sub: 1, role: 'admin' }, process.env.JWT_SECRET || 'dev-secret');

const data = JSON.stringify({
  tipo: 'ingreso',
  motivo: 'test',
  productos: [{ producto_id: 1, cantidad: 1, estado: 'nuevo' }]
});

const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/api/movimientos/directo',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    Authorization: `Bearer ${token}`
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => {
    console.log('status', res.statusCode);
    console.log('body', body);
  });
});

req.on('error', (err) => {
  console.error('request error', err.message);
});

req.write(data);
req.end();
