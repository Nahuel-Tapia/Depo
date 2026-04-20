const { Pool } = require("pg");
const config = require("./backend/src/config/database");
const pool = new Pool(config);
pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
    .then(res => {
        console.log(res.rows.map(r => r.table_name).join(", "));
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });