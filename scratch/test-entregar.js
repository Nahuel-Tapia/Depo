process.chdir(__dirname + '/../backend');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const http = require('http');
const jwt = require('jsonwebtoken');

const secret = process.env.JWT_SECRET;
// operador token
const token = jwt.sign({ sub: 47, nombre: 'operador', role: 'operador' }, secret, { expiresIn: '1h' });

const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/api/entregas/solicitudes/8/entregar',
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': 0 }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try { console.log(JSON.stringify(JSON.parse(data), null, 2)); } catch { console.log(data); }
  });
});
req.on('error', e => console.error(e.message));
req.end();
