process.chdir(__dirname + '/../backend');
require('dotenv').config();
const http = require('http');
const jwt = require('jsonwebtoken');

const secret = process.env.JWT_SECRET || 'dev-secret';
const token = jwt.sign({ sub: 3, nombre: 'Test', role: 'operador' }, secret, { expiresIn: '1h' });

const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/api/entregas/solicitudes/entregadas',
  method: 'GET',
  headers: { Authorization: `Bearer ${token}` }
};

http.get(options, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => console.log('Status:', res.statusCode, '| Body:', data.substring(0, 200)));
}).on('error', e => console.error(e.message));
