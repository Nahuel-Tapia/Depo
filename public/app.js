const state = {
  token: localStorage.getItem("token") || null,
  user: JSON.parse(localStorage.getItem("user") || "null"),
  permissions: [],
  productos: [],
  movimientos: [],
  ajustes: [],
  users: []
};

const loginCard = document.getElementById("loginCard");
const appCard = document.getElementById("appCard");
const loginForm = document.getElementById("loginForm");
const loginMsg = document.getElementById("loginMsg");
const adminMsg = document.getElementById("adminMsg");
const currentUser = document.getElementById("currentUser");
const permissionsList = document.getElementById("permissionsList");
const usersTbody = document.getElementById("usersTbody");
const logoutBtn = document.getElementById("logoutBtn");
const createUserForm = document.getElementById("createUserForm");

// Tabs
const tabButtons = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

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
  currentUser.textContent = state.user.role === 'admin' ? 'A' : state.user.role === 'operador' ? 'O' : 'C';
  renderPermissions();

  // Mostrar/ocultar tabs según permisos
  updateTabsVisibility();

  if (hasPermission("users.read")) {
    document.querySelector('[data-tab="usuarios"]').classList.remove("hidden");
  } else {
    document.querySelector('[data-tab="usuarios"]').classList.add("hidden");
  }

  // Cargar datos iniciales
  await loadProductos();
  await loadMovimientos();
  await loadAjustes();
  await loadUsers();
}

function updateTabsVisibility() {
  const tabs = {
    productos: ["productos.view"],
    movimientos: ["movimientos.view"],
    ajustes: ["ajustes.view"],
    usuarios: ["users.read"]
  };

  Object.entries(tabs).forEach(([tabName, permissions]) => {
    const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
    if (tabBtn) {
      const hasAccess = permissions.some(p => hasPermission(p));
      if (hasAccess) {
        tabBtn.style.display = "";
      } else {
        tabBtn.style.display = "none";
      }
    }
  });
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

// ============ TABS NAVIGATION ============
tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const tabName = btn.dataset.tab;
    
    // Actualizar botones
    tabButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    
    // Actualizar contenido
    tabContents.forEach(tc => tc.classList.add("hidden"));
    document.getElementById(tabName + "Tab").classList.remove("hidden");
  });
});

// ============ PRODUCTOS ============
async function loadProductos() {
  if (!hasPermission("productos.view")) return;
  
  const res = await fetch("/api/productos", { headers: authHeaders() });
  if (!res.ok) return;
  
  const data = await res.json();
  state.productos = data.productos || [];
  renderProductos();
  updateProductoSelects();
}

function renderProductos() {
  const tbody = document.getElementById("productosTbody");
  tbody.innerHTML = "";
  
  state.productos.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.id}</td>
      <td>${p.codigo}</td>
      <td>${p.nombre}</td>
      <td>$${p.precio.toFixed(2)}</td>
      <td>${p.stock_actual}</td>
      <td>
        <div class="inline-actions">
          ${hasPermission("productos.edit") ? `<button class="edit-producto" data-id="${p.id}">Editar</button>` : ""}
          ${hasPermission("productos.delete") ? `<button class="delete-producto" data-id="${p.id}">Eliminar</button>` : ""}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
  
  // Eventos de productos
  document.querySelectorAll(".edit-producto").forEach(btn => {
    btn.addEventListener("click", (e) => editProducto(e.target.dataset.id));
  });
  
  document.querySelectorAll(".delete-producto").forEach(btn => {
    btn.addEventListener("click", (e) => deleteProducto(e.target.dataset.id));
  });
}

function updateProductoSelects() {
  const selects = [
    document.getElementById("movProductoId"),
    document.getElementById("ajuProductoId")
  ];
  
  selects.forEach(sel => {
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">Seleccionar producto...</option>';
    state.productos.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.codigo} - ${p.nombre} (Stock: ${p.stock_actual})`;
      sel.appendChild(opt);
    });
    sel.value = current;
  });
}

document.getElementById("createProductForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("productosMsg");
  msg.textContent = "";
  
  const payload = {
    codigo: document.getElementById("productoCodigo").value.trim(),
    nombre: document.getElementById("productoNombre").value.trim(),
    precio: parseFloat(document.getElementById("productoPrecio").value) || 0,
    descripcion: document.getElementById("productoDescripcion").value.trim() || ""
  };
  
  const res = await fetch("/api/productos", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  
  if (!res.ok) {
    const data = await res.json();
    msg.textContent = data.error || "Error al crear producto";
    return;
  }
  
  document.getElementById("createProductForm").reset();
  await loadProductos();
});

async function editProducto(id) {
  const producto = state.productos.find(p => p.id == id);
  if (!producto) return;
  
  const nuevoNombre = prompt("Nuevo nombre:", producto.nombre);
  if (nuevoNombre === null) return;
  
  const res = await fetch(`/api/productos/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ nombre: nuevoNombre })
  });
  
  if (!res.ok) {
    alert("No se pudo editar el producto");
    return;
  }
  
  await loadProductos();
}

async function deleteProducto(id) {
  if (!confirm("¿Estás seguro?")) return;
  
  const res = await fetch(`/api/productos/${id}`, {
    method: "DELETE",
    headers: authHeaders()
  });
  
  if (!res.ok) {
    alert("No se pudo eliminar el producto");
    return;
  }
  
  await loadProductos();
}

// ============ MOVIMIENTOS ============
async function loadMovimientos() {
  if (!hasPermission("movimientos.view")) return;
  
  const res = await fetch("/api/movimientos", { headers: authHeaders() });
  if (!res.ok) return;
  
  const data = await res.json();
  state.movimientos = data.movimientos || [];
  renderMovimientos();
}

function renderMovimientos() {
  const tbody = document.getElementById("movimientosTbody");
  tbody.innerHTML = "";
  
  state.movimientos.forEach(m => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${m.id}</td>
      <td>${m.codigo} - ${m.nombre}</td>
      <td><span class="badge badge-${m.tipo}">${m.tipo}</span></td>
      <td>${m.cantidad}</td>
      <td>${m.motivo || "-"}</td>
      <td>${m.proveedor || "-"}</td>
      <td>${m.cue || "-"}</td>
      <td>${m.usuario_nombre}</td>
      <td>${new Date(m.created_at).toLocaleDateString()}</td>
    `;
    tbody.appendChild(tr);
  });
}

document.getElementById("movTipo").addEventListener("change", (e) => {
  const tipo = e.target.value;
  const proveedorField = document.getElementById("proveedorField");
  const cueField = document.getElementById("cueField");
  if (tipo === "entrada") {
    proveedorField.style.display = "block";
    cueField.style.display = "none";
  } else if (tipo === "salida") {
    proveedorField.style.display = "none";
    cueField.style.display = "block";
  } else {
    proveedorField.style.display = "none";
    cueField.style.display = "none";
  }
});

document.getElementById("createMovimientoForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("movimientosMsg");
  msg.textContent = "";
  
  const tipo = document.getElementById("movTipo").value;
  const payload = {
    producto_id: parseInt(document.getElementById("movProductoId").value),
    tipo: tipo,
    cantidad: parseInt(document.getElementById("movCantidad").value),
    motivo: document.getElementById("movMotivo").value.trim() || null
  };
  
  if (tipo === "entrada") {
    payload.proveedor = document.getElementById("movProveedor").value.trim() || null;
  } else if (tipo === "salida") {
    payload.cue = document.getElementById("movCue").value.trim() || null;
  }
  
  const res = await fetch("/api/movimientos", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  
  if (!res.ok) {
    const data = await res.json();
    msg.textContent = data.error || "Error al registrar movimiento";
    return;
  }
  
  document.getElementById("createMovimientoForm").reset();
  // Hide fields
  document.getElementById("proveedorField").style.display = "none";
  document.getElementById("cueField").style.display = "none";
  await loadMovimientos();
  await loadProductos();
});

// ============ AJUSTES ============
async function loadAjustes() {
  if (!hasPermission("ajustes.view")) return;
  
  const res = await fetch("/api/ajustes", { headers: authHeaders() });
  if (!res.ok) return;
  
  const data = await res.json();
  state.ajustes = data.ajustes || [];
  renderAjustes();
}

function renderAjustes() {
  const tbody = document.getElementById("ajustesTbody");
  tbody.innerHTML = "";
  
  state.ajustes.forEach(a => {
    const tr = document.createElement("tr");
    const diff = a.cantidad_nueva - a.cantidad_anterior;
    tr.innerHTML = `
      <td>${a.id}</td>
      <td>${a.codigo} - ${a.nombre}</td>
      <td>${a.cantidad_anterior}</td>
      <td>${a.cantidad_nueva}</td>
      <td>${a.motivo}</td>
      <td>${a.usuario_nombre}</td>
      <td>${new Date(a.created_at).toLocaleDateString()}</td>
    `;
    tbody.appendChild(tr);
  });
}

document.getElementById("createAjusteForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("ajustesMsg");
  msg.textContent = "";
  
  const payload = {
    producto_id: parseInt(document.getElementById("ajuProductoId").value),
    cantidad_nueva: parseInt(document.getElementById("ajuCantidad").value),
    motivo: document.getElementById("ajuMotivo").value.trim()
  };
  
  const res = await fetch("/api/ajustes", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  
  if (!res.ok) {
    const data = await res.json();
    msg.textContent = data.error || "Error al crear ajuste";
    return;
  }
  
  document.getElementById("createAjusteForm").reset();
  await loadAjustes();
  await loadProductos();
});

// ============ AUDITORÍA ============



render();
