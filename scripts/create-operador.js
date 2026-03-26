const http = require("http");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

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
    console.log("\n=== Crear usuario Directivo ===");
    const nombre = await question("Nombre del directivo: ");
    const institucion = await question("Institución: ");
    const email = await question("Email: ");
    const password = await question("Contraseña: ");
    rl.close();

    // Login
    console.log("\n1️⃣  Logging as admin...");
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

    // Create directivo
    console.log("\n2️⃣  Creating directivo user...");
    const createRes = await request("POST", "/api/users", {
      nombre,
      email,
      password,
      institucion,
      role: "directivo"
    }, token);

    if (createRes.status !== 201) {
      console.error("❌ Failed:", createRes.data);
      process.exit(1);
    }

    console.log("✅ Directivo created successfully!");
    console.log("\n📋 Login credentials:");
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Institución: ${institucion}`);
    console.log("\n✨ The directivo can now access system features");

  } catch (err) {
    console.error(" 💥 Error:", err.message);
    process.exit(1);
  }
}

main();
