require('dotenv').config();
const http = require('http');
const app = require('../backend/src/server');
const jwt = require('jsonwebtoken');
const { get, all } = require('../backend/src/db.pg');

async function testAll() {
  const users = await all("SELECT id_usuario, email, role, id_institucion, nombre, nivel_educativo FROM usuario ORDER BY id_usuario");
  const testUser = users.find(u => u.id_institucion) || users[0];

  const products = await all("SELECT id_producto, nombre FROM producto LIMIT 3");
  const kits = await all("SELECT id, nombre FROM producto_kit WHERE activo = true LIMIT 3");

  const secret = process.env.JWT_SECRET || 'depo_stock_jwt_secret_key_2026';
  const token = jwt.sign({
    sub: testUser.id_usuario,
    role: 'directivo',
    nombre: testUser.nombre || 'Test',
    id_institucion: testUser.id_institucion
  }, secret, { expiresIn: '1h' });

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;

  async function post(payload) {
    const body = JSON.stringify(payload);
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port,
        path: '/api/pedidos',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Content-Length': Buffer.byteLength(body)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  console.log('--- TEST 1: Producto individual ---');
  const res1 = await post({ producto_id: products[0].id_producto, cantidad: 2, tipo: 'anual', notas: 'Test 1' });
  console.log('Status:', res1.statusCode, 'Body:', res1.body);

  console.log('\n--- TEST 2: Kit ---');
  if (kits.length > 0) {
    const res2 = await post({ kit_id: kits[0].id, cantidad: 1, tipo: 'anual', notas: 'Test 2' });
    console.log('Status:', res2.statusCode, 'Body:', res2.body);
  }

  console.log('\n--- TEST 3: Multiples items (Refuerzo) ---');
  const res3 = await post({
    tipo: 'refuerzo',
    notas: 'Test 3',
    items: [
      { producto_id: products[0].id_producto, cantidad: 3 }
    ]
  });
  console.log('Status:', res3.statusCode, 'Body:', res3.body);

  server.close();
  process.exit(0);
}

testAll().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
