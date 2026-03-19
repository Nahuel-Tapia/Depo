const http = require("http");

async function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port: 4000,
      path,
      method,
      headers: {
        "Content-Type": "application/json"
      }
    };

    if (token) {
      options.headers.Authorization = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolve({ status: res.statusCode, data: JSON.parse(data) });
      });
    });

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  try {
    // Login
    console.log("1️⃣  Logging as admin...");
    const loginRes = await request("POST", "/api/auth/login", {
      email: "admin@depo.local",
      password: "Admin123!"
    });

    if (loginRes.status !== 201) {
      console.error("❌ Login failed:", loginRes.data);
      process.exit(1);
    }

    const token = loginRes.data.token;
    console.log("✅ Login success");

    // Create operador
    console.log("\n2️⃣  Creating operador user...");
    const createRes = await request("POST", "/api/users", {
      nombre: "Operador Demo",
      email: "operador@depo.local",
      password: "Operador123!",
      role: "operador"
    }, token);

    if (createRes.status !== 201) {
      console.error("❌ Failed:", createRes.data);
      process.exit(1);
    }

    console.log("✅ Operador created successfully!");
    console.log("\n📋 Login credentials:");
    console.log("   Email: operador@depo.local");
    console.log("   Password: Operador123!");
    console.log("\n✨ The operador can now see and create:");
    console.log("   - Productos (Products)");
    console.log("   - Movimientos (Movements)");
    console.log("   - Ajustes (Adjustments)");
    console.log("   - Auditoría (Audit logs)");

  } catch (err) {
    console.error(" 💥 Error:", err.message);
    process.exit(1);
  }
}

main();
