require('dotenv').config();
const { all } = require('../backend/src/db.pg');

async function inspectUsers() {
  const users = await all(`SELECT id_usuario, nombre, email, role, id_institucion FROM usuario`);
  console.table(users);
}

inspectUsers();
