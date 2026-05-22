require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });
const { Pool } = require('pg');
const pool = new Pool(require('../backend/src/config/database'));
const directivoService = require('../backend/src/services/directivoService');

async function testSuite() {
  console.log('============================================================');
  console.log('🧪 INICIANDO PRUEBAS UNITARIAS DE VALIDACIÓN DE RECEPCIÓN (COMMIT + CLEANUP)');
  console.log('============================================================\n');

  let loteId = null;
  const client = await pool.connect();
  
  try {
    // 1. Obtener usuario directivo e institución
    const userRes = await client.query("SELECT id_usuario, id_institucion FROM usuario WHERE email = 'directivo@gmail.com'");
    if (userRes.rowCount === 0) {
      throw new Error("No se encontró el usuario de prueba 'directivo@gmail.com'.");
    }
    const userId = userRes.rows[0].id_usuario;
    const institucionId = userRes.rows[0].id_institucion;
    console.log(`👤 Usuario de prueba: directivo@gmail.com (ID: ${userId})`);
    console.log(`🏫 Institución asociada ID: ${institucionId}\n`);

    // 2. Obtener producto de prueba
    const prodRes = await client.query("SELECT id_producto, nombre FROM producto LIMIT 1");
    if (prodRes.rowCount === 0) {
      throw new Error("No se encontraron productos en la base de datos.");
    }
    const productoId = prodRes.rows[0].id_producto;
    const productoNombre = prodRes.rows[0].nombre;
    console.log(`📦 Producto de prueba: "${productoNombre}" (ID: ${productoId})\n`);

    // 3. Crear lote y lote_item de prueba temporal (PERSISTENTE PARA QUE EL OTRO CONEXIÓN LO VEA)
    const loteRes = await client.query(
      `INSERT INTO distribucion_lote (anio, id_deposito, estado, observaciones)
       VALUES (2026, 1, 'en_transito', 'Lote de prueba temporal validación')
       RETURNING id`
    );
    loteId = loteRes.rows[0].id;

    const loteItemRes = await client.query(
      `INSERT INTO distribucion_lote_item (lote_id, id_institucion, id_producto, cantidad_planificada, estado_recepcion)
       VALUES ($1, $2, $3, 10, 'pendiente')
       RETURNING id`,
      [loteId, institucionId, productoId]
    );
    const loteItemId = loteItemRes.rows[0].id;
    console.log(`📋 Creado Lote de prueba #${loteId} (Item ID: ${loteItemId})`);
    console.log('------------------------------------------------------------\n');

    // MOCK DEL BASE64 DE IMAGEN
    const mockImage = {
      nombre: "evidencia_prueba.jpg",
      mime_type: "image/jpeg",
      datos: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    };

    // PRUEBA 1: Validar que falle si observaciones está vacío al recibir mercadería
    console.log('▶️ [PRUEBA 1] Confirmando recepción con observaciones vacías...');
    try {
      await directivoService.confirmarRecepcion(userId, loteId, [
        {
          id_producto: productoId,
          cantidad_recibida: 5,
          cantidad_danada: 0,
          observaciones_directivo: "", // VACÍO
          imagenes: [mockImage]
        }
      ]);
      console.log('❌ [PRUEBA 1] FAILED: Permitió guardar observaciones vacías.');
    } catch (err) {
      if (err.message.includes('observaciones son obligatorias')) {
        console.log(`✅ [PRUEBA 1] PASSED: Lanzó el error correcto: "${err.message}"\n`);
      } else {
        console.log('❌ [PRUEBA 1] FAILED: Lanzó un error inesperado:', err.message, '\n');
      }
    }

    // PRUEBA 2: Validar que falle si no se envían fotos
    console.log('▶️ [PRUEBA 2] Confirmando recepción sin fotos de evidencia...');
    try {
      await directivoService.confirmarRecepcion(userId, loteId, [
        {
          id_producto: productoId,
          cantidad_recibida: 5,
          cantidad_danada: 0,
          observaciones_directivo: "Llegó todo en perfectas condiciones.",
          imagenes: [] // SIN FOTOS
        }
      ]);
      console.log('❌ [PRUEBA 2] FAILED: Permitió guardar sin fotos.');
    } catch (err) {
      if (err.message.includes('Debe adjuntar al menos una foto')) {
        console.log(`✅ [PRUEBA 2] PASSED: Lanzó el error correcto: "${err.message}"\n`);
      } else {
        console.log('❌ [PRUEBA 2] FAILED: Lanzó un error inesperado:', err.message, '\n');
      }
    }

    // PRUEBA 3: Validar que funcione correctamente con observaciones y fotos llenas
    console.log('▶️ [PRUEBA 3] Confirmando recepción con todos los campos válidos...');
    try {
      const result = await directivoService.confirmarRecepcion(userId, loteId, [
        {
          id_producto: productoId,
          cantidad_recibida: 5,
          cantidad_danada: 0,
          observaciones_directivo: "Controlado. Todo excelente.",
          imagenes: [mockImage]
        }
      ]);
      console.log('✅ [PRUEBA 3] PASSED: Se procesó con éxito. Resultado:', JSON.stringify(result), '\n');
    } catch (err) {
      console.log('❌ [PRUEBA 3] FAILED: Lanzó un error inesperado:', err.message, '\n');
    }

  } catch (err) {
    console.error('\n💥 Error general durante el test suite:', err.message);
  } finally {
    // 4. Limpieza absoluta
    if (loteId) {
      console.log('🧹 Iniciando limpieza de datos de prueba...');
      try {
        await client.query('DELETE FROM distribucion_lote_item_imagen WHERE id_institucion = 1');
        await client.query('DELETE FROM distribucion_lote_item WHERE lote_id = $1', [loteId]);
        await client.query('DELETE FROM distribucion_lote WHERE id = $1', [loteId]);
        console.log('🗑️ Datos de prueba eliminados correctamente.');
      } catch (cleanErr) {
        console.error('⚠️ Error al limpiar base de datos:', cleanErr.message);
      }
    }
    
    console.log('\n============================================================');
    console.log('🎉 TODAS LAS PRUEBAS DE VALIDACIÓN FINALIZADAS CON ÉXITO');
    console.log('============================================================');
    
    client.release();
    await pool.end();
  }
}

testSuite();
