const { all } = require("./src/db.pg");

async function check() {
  try {
    const zones = await all("SELECT id, name, director_area_id FROM zona");
    console.log("ZONES:", JSON.stringify(zones, null, 2));

    const zoneInstitutions = await all("SELECT zona_id, institucion_id FROM zona_institucion");
    console.log("ZONE_INSTITUTIONS:", JSON.stringify(zoneInstitutions, null, 2));
  } catch (err) {
    console.error(err);
  }
}

check();
