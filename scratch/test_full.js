const { all, pool } = require("../backend/src/db.pg");
// Mocking express router to avoid errors when importing compras.js
const express = require("express");
const originalRouter = express.Router;
express.Router = () => ({ use: () => {}, get: () => {}, post: () => {}, patch: () => {}, delete: () => {} });

const { getEstadoDirectores, ensureTables } = require("../backend/src/routes/compras.js");

async function testFull() {
  try {
    console.log("Testing ensureTables...");
    await ensureTables();
    console.log("ensureTables OK");

    const anio = 2026;
    console.log("Testing getEstadoDirectores...");
    const rows = await getEstadoDirectores({ anio });
    console.log("Success:", rows.length, "directors found");
    console.log(JSON.stringify(rows[0], null, 2));
  } catch (err) {
    console.error("Error detected:", err.message);
    if (err.stack) console.error(err.stack);
  } finally {
    await pool.end();
  }
}

testFull();
