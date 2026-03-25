const state = {
  token: localStorage.getItem("token") || null,
  user: JSON.parse(localStorage.getItem("user") || "null"),
  permissions: [],
  productos: [],
  movimientos: [],
  users: []
};

const loginCard = document.getElementById("loginCard");
const registerCard = document.getElementById("registerCard");
const appCard = document.getElementById("appCard");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const loginMsg = document.getElementById("loginMsg");
const registerMsg = document.getElementById("registerMsg");
const adminMsg = document.getElementById("adminMsg");
const currentUser = document.getElementById("currentUser");
const permissionsList = document.getElementById("permissionsList");
const usersTbody = document.getElementById("usersTbody");
const logoutBtn = document.getElementById("logoutBtn");
const createUserForm = document.getElementById("createUserForm");

function showMessage(el, text, type = "error") {
  if (!el) return;
  if (!text) {
    el.textContent = "";
    el.classList.remove("show", "msg-success", "msg-error");
    return;
  }

  el.textContent = text;
  el.classList.add("show");
  el.classList.remove("msg-success", "msg-error");
  el.classList.add(type === "success" ? "msg-success" : "msg-error");
}

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

function handleUnauthorized() {
  clearSession();
  if (window.location.pathname === "/registro") {
    window.location.href = "/";
    return;
  }

  showMessage(loginMsg, "Sesión expirada. Por favor, ingresa de nuevo.", "error");
  render();
}

async function processApiResponse(res) {
  if (res.status === 401) {
    handleUnauthorized();
    return { ok: false, error: "Unauthorized" };
  }

  if (res.status === 403) {
    return { ok: false, error: "Forbidden" };
  }

  if (!res.ok) {
    return { ok: false, error: `HTTP ${res.status}` };
  }

  return { ok: true };
}

async function loadMyPermissions() {
  const res = await fetch("/api/permissions/me", {
    headers: authHeaders()
  });

  const result = await processApiResponse(res);
  if (!result.ok) {
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
    if (loginCard) loginCard.classList.remove("hidden");
    if (registerCard) registerCard.classList.remove("hidden");
    if (appCard) appCard.classList.add("hidden");
    return;
  }

  await loadMyPermissions();

  if (loginCard) loginCard.classList.add("hidden");
  if (registerCard) registerCard.classList.add("hidden");
  if (appCard) appCard.classList.remove("hidden");
  currentUser.textContent = state.user.role === "admin"
    ? "A"
    : state.user.role === "directivo"
      ? "D"
      : state.user.role === "operador"
        ? "O"
        : "C";
  renderPermissions();

  // Mostrar/ocultar tabs según permisos
  updateTabsVisibility();
  updateFormVisibilityByPermissions();

  if (hasPermission("users.read")) {
    document.querySelector('[data-tab="usuarios"]').classList.remove("hidden");
  } else {
    document.querySelector('[data-tab="usuarios"]').classList.add("hidden");
  }

  // Cargar datos iniciales
  await loadProductos();
  await loadMovimientos();
  await loadUsers();
}

function updateTabsVisibility() {
  const tabs = {
    productos: ["productos.view"],
    movimientos: ["movimientos.view"],
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

function updateFormVisibilityByPermissions() {
  const createProductForm = document.getElementById("createProductForm");
  const createMovimientoForm = document.getElementById("createMovimientoForm");
  const createUserFormEl = document.getElementById("createUserForm");

  if (createProductForm?.parentElement) {
    createProductForm.parentElement.style.display = hasPermission("productos.create") ? "" : "none";
  }

  if (createMovimientoForm?.parentElement) {
    createMovimientoForm.parentElement.style.display = hasPermission("movimientos.create") ? "" : "none";
  }

  if (createUserFormEl?.parentElement) {
    createUserFormEl.parentElement.style.display = hasPermission("users.create") ? "" : "none";
  }
}

async function loadUsers() {
  const res = await fetch("/api/users", {
    headers: authHeaders()
  });

  const result = await processApiResponse(res);
  if (!result.ok) {
    usersTbody.innerHTML = "";
    adminMsg.textContent = result.error === "Forbidden" ? "No tiene permiso para ver usuarios" : "No se pudo cargar usuarios";
    return;
  }

  adminMsg.textContent = "";
  const data = await res.json();
  usersTbody.innerHTML = "";

  data.users.forEach((u) => {
    const canChangeRole = hasPermission("users.role.update");
    const canToggleStatus = hasPermission("users.status.update");

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u.nombre}</td>
      <td>${u.email}</td>
      <td>${u.cue || "-"}</td>
      <td><span class="badge">${u.role}</span></td>
      <td>${u.activo ? "Sí" : "No"}</td>
      <td>
        <div class="inline-actions">
          ${canChangeRole ? `<button data-action="promote" data-id="${u.id}">Rol +</button>` : ""}
          ${canToggleStatus ? `<button data-action="toggle" data-id="${u.id}" data-active="${u.activo}">${u.activo ? "Desactivar" : "Activar"}</button>` : ""}
        </div>
      </td>
    `;
    usersTbody.appendChild(tr);
  });
}

usersTbody?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const id = btn.dataset.id;
  if (!id) return;

  if (btn.dataset.action === "promote") {
    const role = prompt("Nuevo rol (admin, directivo, operador, consulta):", "operador");
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

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  showMessage(loginMsg, "");

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const cue = /^\d+$/.test(email) ? email : "";

  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, cue, password })
  });

  const data = await res.json();
  if (!res.ok) {
    showMessage(loginMsg, data.error || "Error de autenticación", "error");
    return;
  }

  showMessage(loginMsg, data.message || "Inicio de sesión correcto", "success");

  setSession(data.token, data.user);
  loginForm.reset();
  await render();
});

registerForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  showMessage(registerMsg, "");

  const nombre = document.getElementById("registerNombre").value.trim();
  const cue = document.getElementById("registerCue").value.trim();
  const password = document.getElementById("registerPassword").value;

  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre, cue, password })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (data.message) {
      showMessage(registerMsg, data.message, "error");
    } else if (data.error && data.helpCode) {
      showMessage(registerMsg, `${data.error}. Número de ayuda: ${data.helpCode}`, "error");
    } else {
      showMessage(registerMsg, data.error || "No se pudo registrar", "error");
    }
    return;
  }

  registerForm.reset();
  showMessage(registerMsg, data.message || "Usuario creado correctamente", "success");
});

createUserForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  adminMsg.textContent = "";

  if (!hasPermission("users.create")) {
    adminMsg.textContent = "No tiene permiso para crear usuarios";
    return;
  }

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

logoutBtn?.addEventListener("click", () => {
  clearSession();
  window.location.href = "/";
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
  const result = await processApiResponse(res);
  if (!result.ok) {
    if (result.error === "Forbidden") {
      adminMsg.textContent = "No tiene permiso para ver productos";
    }
    return;
  }
  
  const data = await res.json();
  state.productos = data.productos || [];
  renderProductos();
  updateProductoSelects();
}

function renderProductos() {
  const tbody = document.getElementById("productosTbody");
  tbody.innerHTML = "";
  
  state.productos.forEach(p => {
    let stockStatus = "";
    let color = "";
    if (p.stock_actual === 0) {
      stockStatus = "Sin stock";
      color = "red";
    } else if (p.stock_actual < 10) {
      stockStatus = "Bajo stock";
      color = "red";
    } else if (p.stock_actual <= 20) {
      stockStatus = "Medio stock";
      color = "#ff9900";
    } else {
      stockStatus = "Buen stock";
      color = "green";
    }
    
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.codigo}</td>
      <td>${p.nombre}</td>
      <td>${p.tipo || "-"}</td>
      <td>${p.stock_actual}</td>
      <td style="color: ${color};">${stockStatus}</td>
      <td>${p.proveedor || "-"}</td>
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

  if (!hasPermission("productos.create")) {
    msg.textContent = "No tiene permiso para crear productos";
    return;
  }
  
  const payload = {
    codigo: document.getElementById("productoCodigo").value.trim(),
    nombre: document.getElementById("productoNombre").value.trim(),
    tipo: document.getElementById("productoTipo").value,
    descripcion: document.getElementById("productoDescripcion").value.trim() || "",
    proveedor: document.getElementById("productoProveedor").value.trim() || null
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
    const data = await res.json();
    alert(data.error || "No se pudo eliminar el producto");
    return;
  }
  
  await loadProductos();
}

// ============ MOVIMIENTOS ============
async function loadMovimientos() {
  if (!hasPermission("movimientos.view")) return;
  
  const res = await fetch("/api/movimientos", { headers: authHeaders() });
  const result = await processApiResponse(res);
  if (!result.ok) {
    if (result.error === "Forbidden") {
      adminMsg.textContent = "No tiene permiso para ver movimientos";
    }
    return;
  }
  
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

document.getElementById("movTipo")?.addEventListener("change", (e) => {
  const tipo = e.target.value;
  const proveedorField = document.getElementById("proveedorField");
  const cueField = document.getElementById("cueField");
  const movProveedor = document.getElementById("movProveedor");
  const movCue = document.getElementById("movCue");

  if (tipo === "entrada") {
    proveedorField.classList.remove("hidden");
    cueField.classList.add("hidden");
    movProveedor.required = true;
    movCue.required = false;
    movCue.value = "";
  } else if (tipo === "salida") {
    proveedorField.classList.add("hidden");
    cueField.classList.remove("hidden");
    movProveedor.required = false;
    movCue.required = true;
    movProveedor.value = "";
  } else {
    proveedorField.classList.add("hidden");
    cueField.classList.add("hidden");
    movProveedor.required = false;
    movCue.required = false;
  }
});

document.getElementById("createMovimientoForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("movimientosMsg");
  msg.textContent = "";
  
  const tipo = document.getElementById("movTipo").value;
  const productoId = parseInt(document.getElementById("movProductoId").value);
  const cantidad = parseInt(document.getElementById("movCantidad").value);
  const payload = {
    producto_id: productoId,
    tipo: tipo,
    cantidad: cantidad,
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
  document.getElementById("movProveedor").required = false;
  document.getElementById("movCue").required = false;
  document.getElementById("proveedorField").classList.add("hidden");
  document.getElementById("cueField").classList.add("hidden");
  await loadMovimientos();
  await loadProductos();

  if (tipo === "salida") {
    const productoActualizado = state.productos.find((p) => p.id === productoId);
    if (productoActualizado && productoActualizado.stock_actual < 10) {
      alert(
        `Alerta de bajo stock: ${productoActualizado.nombre} (${productoActualizado.codigo}) quedo con ${productoActualizado.stock_actual} unidades.`
      );
    }
  }
});

// ============ AUDITORÍA ============



render();
