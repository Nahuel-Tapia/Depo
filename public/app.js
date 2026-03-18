const state = {
  token: localStorage.getItem("token") || null,
  user: JSON.parse(localStorage.getItem("user") || "null"),
  permissions: []
};

const loginCard = document.getElementById("loginCard");
const appCard = document.getElementById("appCard");
const loginForm = document.getElementById("loginForm");
const loginMsg = document.getElementById("loginMsg");
const adminMsg = document.getElementById("adminMsg");
const currentUser = document.getElementById("currentUser");
const permissionsList = document.getElementById("permissionsList");
const adminArea = document.getElementById("adminArea");
const nonAdminArea = document.getElementById("nonAdminArea");
const usersTbody = document.getElementById("usersTbody");
const logoutBtn = document.getElementById("logoutBtn");
const createUserForm = document.getElementById("createUserForm");

function setSession(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

function clearSession() {
  state.token = null;
  state.user = null;
  state.permissions = [];
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${state.token}`
  };
}

function hasPermission(permission) {
  return state.permissions.includes(permission);
}

async function loadMyPermissions() {
  const res = await fetch("/api/permissions/me", {
    headers: authHeaders()
  });

  if (!res.ok) {
    state.permissions = [];
    return;
  }

  const data = await res.json();
  state.permissions = data.permissions || [];
}

function renderPermissions() {
  permissionsList.innerHTML = "";

  if (state.permissions.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Sin permisos cargados";
    permissionsList.appendChild(li);
    return;
  }

  state.permissions.forEach((permission) => {
    const li = document.createElement("li");
    li.textContent = permission;
    permissionsList.appendChild(li);
  });
}

async function render() {
  if (!state.token || !state.user) {
    loginCard.classList.remove("hidden");
    appCard.classList.add("hidden");
    return;
  }

  await loadMyPermissions();

  loginCard.classList.add("hidden");
  appCard.classList.remove("hidden");
  currentUser.textContent = `${state.user.nombre} (${state.user.role})`;
  renderPermissions();

  if (hasPermission("users.read")) {
    adminArea.classList.remove("hidden");
    nonAdminArea.classList.add("hidden");
    loadUsers();
  } else {
    adminArea.classList.add("hidden");
    nonAdminArea.classList.remove("hidden");
  }
}

async function loadUsers() {
  const res = await fetch("/api/users", {
    headers: authHeaders()
  });

  if (!res.ok) {
    usersTbody.innerHTML = "";
    adminMsg.textContent = "No se pudo cargar usuarios";
    return;
  }

  adminMsg.textContent = "";
  const data = await res.json();
  usersTbody.innerHTML = "";

  data.users.forEach((u) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u.id}</td>
      <td>${u.nombre}</td>
      <td>${u.email}</td>
      <td><span class="badge">${u.role}</span></td>
      <td>${u.activo ? "Sí" : "No"}</td>
      <td>
        <div class="inline-actions">
          <button data-action="promote" data-id="${u.id}">Rol +</button>
          <button data-action="toggle" data-id="${u.id}" data-active="${u.activo}">
            ${u.activo ? "Desactivar" : "Activar"}
          </button>
        </div>
      </td>
    `;
    usersTbody.appendChild(tr);
  });
}

usersTbody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const id = btn.dataset.id;
  if (!id) return;

  if (btn.dataset.action === "promote") {
    const role = prompt("Nuevo rol (admin, operador, consulta):", "operador");
    if (!role) return;

    const res = await fetch(`/api/users/${id}/role`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ role })
    });

    if (!res.ok) {
      adminMsg.textContent = "No se pudo actualizar rol";
      return;
    }

    loadUsers();
  }

  if (btn.dataset.action === "toggle") {
    const current = btn.dataset.active === "1" || btn.dataset.active === "true";

    const res = await fetch(`/api/users/${id}/active`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ activo: !current })
    });

    if (!res.ok) {
      adminMsg.textContent = "No se pudo actualizar estado";
      return;
    }

    loadUsers();
  }
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginMsg.textContent = "";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();
  if (!res.ok) {
    loginMsg.textContent = data.error || "Error de autenticación";
    return;
  }

  setSession(data.token, data.user);
  loginForm.reset();
  await render();
});

createUserForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  adminMsg.textContent = "";

  const payload = {
    nombre: document.getElementById("newNombre").value.trim(),
    email: document.getElementById("newEmail").value.trim(),
    password: document.getElementById("newPassword").value,
    role: document.getElementById("newRole").value
  };

  const res = await fetch("/api/users", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    adminMsg.textContent = data.error || "No se pudo crear usuario";
    return;
  }

  createUserForm.reset();
  loadUsers();
});

logoutBtn.addEventListener("click", () => {
  clearSession();
  render();
});

render();
