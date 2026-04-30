const { all } = require("./src/db.pg");

async function checkData() {
  try {
    const rows = await all("SELECT cue, nombre, nivel_educativo, nivel FROM institucion LIMIT 20");
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkData();
