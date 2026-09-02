require('dotenv').config();
const http = require('http');
const app = require('../backend/src/server');
const jwt = require('jsonwebtoken');
const { get, all } = require('../backend/src/db.pg');

async function test() {
  const users = await all("SELECT id_usuario, email, role, id_institucion, nombre, nivel_educativo FROM usuario ORDER BY id_usuario");
  console.log('All users:', users);
  
  let testUser = users.find(u => u.id_institucion);
  if (!testUser) {
    testUser = users[0];
    if (!testUser) { console.log('No users'); process.exit(1); }
    const inst = await get("SELECT id_institucion FROM institucion LIMIT 1");
    if (!inst) { console.log('No institutions'); process.exit(1); }
    testUser.id_institucion = inst.id_institucion;
  }
  
  console.log('\nUser for test:', testUser);

  const products = await all("SELECT id_producto, nombre FROM producto LIMIT 3");
  console.log('Products:', products);
  if (!products.length) { console.log('No products'); process.exit(1); }

  // Check kit_escuela existence
  try {
    const kitCheck = await all("SELECT id, nombre FROM kit_escuela WHERE activo = true LIMIT 3");
    console.log('kit_escuela table exists, kits:', kitCheck);
  } catch (e) {
    console.log('kit_escuela table does NOT exist:', e.message);
  }

  // Check producto_kit existence (alternate kit system)
  try {
    const pkCheck = await all("SELECT id, nombre FROM producto_kit WHERE activo = true LIMIT 3");
    console.log('producto_kit table exists, kits:', pkCheck);
  } catch (e) {
    console.log('producto_kit table does NOT exist:', e.message);
  }

  // Check kit_producto_anual existence
  try {
    const kpaCheck = await all("SELECT * FROM kit_producto_anual LIMIT 3");
    console.log('kit_producto_anual rules:', kpaCheck);
  } catch (e) {
    console.log('kit_producto_anual table does NOT exist:', e.message);
  }

  // Generate JWT
  const secret = process.env.JWT_SECRET || 'depo_stock_jwt_secret_key_2026';
  const token = jwt.sign({
    sub: testUser.id_usuario,
    role: testUser.role || 'directivo',
    nombre: testUser.nombre || 'Test',
    nivel_educativo: testUser.nivel_educativo || null
  }, secret, { expiresIn: '1h' });

  // Start server
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  console.log(`\nServer on port ${port}`);

  // Build payload with producto_id (not kit)
  const payload = {
    producto_id: products[0].id_producto,
    cantidad: 2,
    tipo: 'anual',
    notas: 'Test debug'
  };
  console.log('POST payload:', JSON.stringify(payload));

  // Make HTTP request
  const body = JSON.stringify(payload);
  const response = await new Promise((resolve, reject) => {
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

  console.log('\n====== RESPONSE ======');
  console.log('Status:', response.statusCode);
  try {
    const parsed = JSON.parse(response.body);
    console.log('Body:', JSON.stringify(parsed, null, 2));
  } catch {
    console.log('Raw body:', response.body);
  }

  if (response.statusCode === 500) {
    console.log('\n❌ 500 ERROR REPRODUCED!');
  } else if (response.statusCode === 201) {
    console.log('\n✅ Pedido created successfully');
  } else {
    console.log('\n⚠️ Status:', response.statusCode);
  }

  server.close();
  process.exit(0);
}

test().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
