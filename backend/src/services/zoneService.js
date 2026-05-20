const { all, get, run } = require("../db.pg");
const { isAdminLikeRole } = require("../middleware/auth");

async function createZone(user, { name, nivel_educativo, director_area_id }) {
  const role = String(user?.role || '').toLowerCase();
  
  if (role !== 'director_area' && !isAdminLikeRole(user?.role)) {
    throw { status: 403, message: 'Solo el director de área puede crear zonas.' };
  }
  if (!name || !nivel_educativo) {
    throw { status: 400, message: 'Faltan datos requeridos.' };
  }
  if (role === 'director_area' && user.nivel_educativo && user.nivel_educativo !== nivel_educativo) {
    throw { status: 403, message: 'Solo puede crear zonas de su nivel asignado.' };
  }

  let directorAreaId = null;
  if (role === 'director_area') {
    directorAreaId = Number(user.sub);
  } else if (isAdminLikeRole(user?.role)) {
    const pick = Number(director_area_id || 0);
    if (Number.isInteger(pick) && pick > 0) {
      const row = await get(
        `SELECT id_usuario FROM usuario WHERE id_usuario = ? AND role = 'director_area' AND (activo IS NULL OR activo = TRUE)`,
        [pick]
      );
      if (row?.id_usuario) directorAreaId = Number(row.id_usuario);
    }
    if (!directorAreaId) {
      const first = await get(
        `SELECT id_usuario FROM usuario WHERE role = 'director_area' AND (activo IS NULL OR activo = TRUE) ORDER BY id_usuario ASC LIMIT 1`
      );
      if (first?.id_usuario) directorAreaId = Number(first.id_usuario);
    }
    if (!directorAreaId) {
      throw { status: 400, message: 'No hay Director de Área para asociar la zona. Creá uno o pasá director_area_id.' };
    }
  }

  const result = await run(
    `INSERT INTO zona (name, nivel_educativo, director_area_id, activo, created_at)
     VALUES ($1, $2, $3, TRUE, NOW())
     RETURNING id`,
    [name, nivel_educativo, directorAreaId]
  );
  
  return { id: result.lastID, name, nivel_educativo, director_area_id: directorAreaId };
}

async function addSchoolsToZone(user, zoneId, escuelaIds) {
  if (!Array.isArray(escuelaIds) || escuelaIds.length === 0) {
    throw { status: 400, message: 'Debes enviar un array de escuelas.' };
  }
  
  const zone = await get('SELECT id, nivel_educativo, director_area_id FROM zona WHERE id = $1', [zoneId]);
  if (!zone) {
    throw { status: 404, message: 'Zona no encontrada.' };
  }

  const ownsOrElevated =
    isAdminLikeRole(user?.role) ||
    (user.role === 'director_area' && user.sub === zone.director_area_id);
  if (!ownsOrElevated) {
    throw { status: 403, message: 'No autorizado.' };
  }

  const placeholders = escuelaIds.map((_, i) => `$${i + 1}`).join(',');
  const escuelas = await all(
    `SELECT id_institucion, nivel_educativo FROM institucion WHERE id_institucion IN (${placeholders})`,
    escuelaIds
  );
  
  const soloNivel = escuelas.every(e => e.nivel_educativo === zone.nivel_educativo);
  if (!soloNivel) {
    throw { status: 400, message: 'Solo puedes añadir escuelas del mismo nivel que la zona.' };
  }

  await run('DELETE FROM zona_institucion WHERE zona_id = $1', [zoneId]);
  for (const escuelaId of escuelaIds) {
    await run(
      `INSERT INTO zona_institucion (zona_id, institucion_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [zoneId, escuelaId]
    );
  }

  return { ok: true };
}

async function assignSupervisorsToZone(user, zoneId, supervisorIds) {
  if (!Array.isArray(supervisorIds) || supervisorIds.length === 0) {
    throw { status: 400, message: 'Debes enviar un array de supervisores.' };
  }
  
  const zone = await get('SELECT id, nivel_educativo, director_area_id FROM zona WHERE id = $1', [zoneId]);
  if (!zone) {
    throw { status: 404, message: 'Zona no encontrada.' };
  }

  const ownsOrElevated =
    isAdminLikeRole(user?.role) ||
    (user.role === 'director_area' && user.sub === zone.director_area_id);
  if (!ownsOrElevated) {
    throw { status: 403, message: 'No autorizado.' };
  }

  const placeholders = supervisorIds.map((_, i) => `$${i + 1}`).join(',');
  const supervisores = await all(
    `SELECT id_usuario, role, nivel_educativo FROM usuario WHERE id_usuario IN (${placeholders})`,
    supervisorIds
  );

  const soloSupervisores = supervisores.every(s => s.role === 'supervisor' && s.nivel_educativo === zone.nivel_educativo);
  if (!soloSupervisores) {
    throw { status: 400, message: 'Solo puedes asignar supervisores de tu nivel y rol.' };
  }

  await run('DELETE FROM zona_supervisor WHERE zona_id = $1', [zoneId]);
  for (const s of supervisorIds) {
    await run(
      `INSERT INTO zona_supervisor (zona_id, supervisor_id, created_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`,
      [zoneId, s]
    );
  }

  return { ok: true };
}

module.exports = {
  createZone,
  addSchoolsToZone,
  assignSupervisorsToZone
};
