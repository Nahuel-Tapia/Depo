const state = {
  token: localStorage.getItem("token") || null,
  user: JSON.parse(localStorage.getItem("user") || "null"),
  permissions: [],
  productos: [],
  movimientos: [],
  pedidos: [],
  users: [],
  instituciones: []
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
const pedidosTbody = document.getElementById("pedidosTbody");
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
  await loadPedidos();
  await loadUsers();
  await loadInstituciones();
}

function updateTabsVisibility() {
  const tabs = {
    productos: ["productos.view"],
    movimientos: ["movimientos.view"],
    pedidos: ["pedidos.view"],
    instituciones: ["instituciones.view"],
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
  const createPedidoForm = document.getElementById("createPedidoForm");
  const createUserFormEl = document.getElementById("createUserForm");

  if (createProductForm?.parentElement) {
    createProductForm.parentElement.style.display = hasPermission("productos.create") ? "" : "none";
  }

  if (createMovimientoForm?.parentElement) {
    createMovimientoForm.parentElement.style.display = hasPermission("movimientos.create") ? "" : "none";
  }

  if (createPedidoForm?.parentElement) {
    const canCreatePedido = hasPermission("pedidos.create") && state.user?.role === "directivo";
    createPedidoForm.parentElement.style.display = canCreatePedido ? "" : "none";
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
    const canDeleteUser = hasPermission("users.delete") && state.user?.role === "admin";
    const canDeleteThisUser = canDeleteUser && Number(u.id) !== Number(state.user?.id);

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
          ${canDeleteThisUser ? `<button data-action="delete" data-id="${u.id}">Eliminar</button>` : ""}
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

    let institucion = null;
    if (role === "directivo") {
      institucion = prompt("Institución del usuario (obligatoria para directivo):", "")?.trim() || "";
      if (!institucion) {
        adminMsg.textContent = "La institución es obligatoria para rol directivo";
        return;
      }
    }

    const res = await fetch(`/api/users/${id}/role`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ role, institucion })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      adminMsg.textContent = data.error || "No se pudo actualizar rol";
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

  if (btn.dataset.action === "delete") {
    if (!hasPermission("users.delete") || state.user?.role !== "admin") {
      adminMsg.textContent = "No tiene permiso para eliminar usuarios";
      return;
    }

    const confirmed = window.confirm("¿Seguro que querés eliminar este usuario?");
    if (!confirmed) return;

    const res = await fetch(`/api/users/${id}`, {
      method: "DELETE",
      headers: authHeaders()
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      adminMsg.textContent = data.error || "No se pudo eliminar usuario";
      return;
    }

    adminMsg.textContent = "Usuario eliminado correctamente";
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

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const invalidCredentialsCodes = ["INVALID_PASSWORD", "INVALID_CREDENTIALS"];
    const errorText = String(data.error || "").toLowerCase();
    const isInvalidCredentialsText = errorText.includes("credenciales") && errorText.includes("invalid");
    const shouldUseUnifiedMessage = invalidCredentialsCodes.includes(data.code) || res.status === 401 || isInvalidCredentialsText;

    const message = shouldUseUnifiedMessage
      ? "contraseña o usuario incorrectos"
      : (data.error || "No se pudo iniciar sesion. Intente nuevamente en unos minutos.");

    showMessage(loginMsg, message, "error");
    return;
  }

  showMessage(loginMsg, data.message || "Inicio de sesión correcto", "success");

  setSession(data.token, data.user);
  loginForm.reset();
  await render();
});

// Buscar nombre de escuela por CUE
document.getElementById("registerCue")?.addEventListener("blur", async (e) => {
  const cue = e.target.value.trim();
  const escuelaField = document.getElementById("registerEscuela");
  const cueStatus = document.getElementById("cueStatus");
  
  if (!cue || cue.length !== 9) {
    escuelaField.value = "";
    cueStatus.textContent = "";
    return;
  }

  try {
    const res = await fetch(`/api/instituciones/public/cue/${cue}`);
    const data = await res.json().catch(() => ({}));
    
    if (res.ok && data.nombre) {
      escuelaField.value = data.nombre;
      cueStatus.textContent = "✓ Escuela encontrada";
      cueStatus.style.color = "#10b981";
    } else {
      escuelaField.value = "";
      cueStatus.textContent = data.error || "Escuela no encontrada";
      cueStatus.style.color = "#ef4444";
    }
  } catch (err) {
    escuelaField.value = "";
    cueStatus.textContent = "Error al buscar escuela";
    cueStatus.style.color = "#ef4444";
  }
});

registerForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  showMessage(registerMsg, "");

  const nombre = document.getElementById("registerNombre").value.trim();
  const cue = document.getElementById("registerCue").value.trim();
  const numero = document.getElementById("registerNumero").value.trim();
  const password = document.getElementById("registerPassword").value;

  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre, cue, numero, password })
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

  // Hacer login automático después del registro
  const loginRes = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cue, password })
  });

  const loginData = await loginRes.json().catch(() => ({}));
  if (!loginRes.ok) {
    showMessage(registerMsg, "Usuario creado pero hay error al iniciar sesión. Por favor inicia sesión manualmente.", "error");
    return;
  }

  setSession(loginData.token, loginData.user);
  registerForm.reset();
  await render();
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
    institucion: document.getElementById("newInstitucion")?.value.trim() || null,
    password: document.getElementById("newPassword").value,
    role: document.getElementById("newRole").value
  };

  if (payload.role === "directivo" && !payload.institucion) {
    adminMsg.textContent = "La institución es obligatoria para rol directivo";
    return;
  }

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

document.getElementById("newRole")?.addEventListener("change", (e) => {
  const institucionInput = document.getElementById("newInstitucion");
  if (!institucionInput) return;
  institucionInput.required = e.target.value === "directivo";
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
  
  // Cargar categorías para el dropdown
  await loadCategoriasDropdown();
  
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

async function loadCategoriasDropdown() {
  const select = document.getElementById("productoCategoria");
  if (!select) return;
  
  try {
    const res = await fetch("/api/productos/categorias", { headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      const categorias = data.categorias || [];
      select.innerHTML = '<option value="">-- Sin categoría --</option>';
      categorias.forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat.id;
        opt.textContent = cat.nombre;
        select.appendChild(opt);
      });
    }
  } catch (err) {
    console.error("Error cargando categorías:", err);
  }
}

function renderProductos() {
  const tbody = document.getElementById("productosTbody");
  tbody.innerHTML = "";
  
  state.productos.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.id}</td>
      <td>${p.nombre}</td>
      <td>${p.unidad_medida || "unidad"}</td>
      <td>${p.stock_minimo || 0}</td>
      <td>${p.categoria_nombre || "-"}</td>
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
    { el: document.getElementById("movProductoId"), showStock: false },
    { el: document.getElementById("ajuProductoId"), showStock: false },
    { el: document.getElementById("pedidoProductoId"), showStock: false }
  ];

  selects.forEach(({ el, showStock }) => {
    if (!el) return;
    const current = el.value;
    el.innerHTML = '<option value="">Seleccionar producto...</option>';
    state.productos.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.nombre} (${p.unidad_medida || 'unidad'})`;
      el.appendChild(opt);
    });
    el.value = current;
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
    nombre: document.getElementById("productoNombre").value.trim(),
    unidad_medida: document.getElementById("productoUnidad").value.trim() || "unidad",
    stock_minimo: parseInt(document.getElementById("productoStockMin").value) || 0,
    id_categoria: document.getElementById("productoCategoria").value || null
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
      <td>${m.producto_nombre || "-"}</td>
      <td><span class="badge badge-${m.tipo}">${m.tipo}</span></td>
      <td>${m.cantidad}</td>
      <td>${m.motivo || "-"}</td>
      <td>${m.usuario_nombre || "-"}</td>
      <td>${new Date(m.created_at).toLocaleDateString()}</td>
    `;
    tbody.appendChild(tr);
  });
}

document.getElementById("createMovimientoForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("movimientosMsg");
  msg.textContent = "";
  
  const tipo = document.getElementById("movTipo").value;
  const productoId = parseInt(document.getElementById("movProductoId").value);
  const cantidad = parseInt(document.getElementById("movCantidad").value);
  
  if (!productoId || !tipo || !cantidad) {
    msg.textContent = "Complete todos los campos obligatorios";
    return;
  }
  
  const payload = {
    producto_id: productoId,
    tipo: tipo,
    cantidad: cantidad,
    motivo: document.getElementById("movMotivo").value.trim() || null
  };
  
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
  await loadMovimientos();
  await loadProductos();
});

// ============ PEDIDOS ============
async function loadPedidos() {
  if (!hasPermission("pedidos.view")) return;

  const res = await fetch("/api/pedidos", { headers: authHeaders() });
  const result = await processApiResponse(res);
  if (!result.ok) {
    const pedidosMsg = document.getElementById("pedidosMsg");
    if (pedidosMsg) {
      pedidosMsg.textContent = result.error === "Forbidden"
        ? "No tiene permiso para ver pedidos"
        : "No se pudieron cargar pedidos";
    }
    return;
  }

  const data = await res.json();
  state.pedidos = data.pedidos || [];
  renderPedidos();
}

function renderPedidos() {
  if (!pedidosTbody) return;
  pedidosTbody.innerHTML = "";
  const canViewStock = hasPermission("pedidos.manage");
  const pedidosStockHeader = document.getElementById("pedidosStockHeader");
  if (pedidosStockHeader) {
    pedidosStockHeader.style.display = canViewStock ? "" : "none";
  }

  state.pedidos.forEach((pedido) => {
    const canManage = hasPermission("pedidos.manage");
    const canCancel = hasPermission("pedidos.create") && pedido.estado === "pendiente";
    const stockActual = Number(pedido.stock_actual || 0);
    const stockSuficiente = stockActual >= Number(pedido.cantidad || 0);
    const actions = [];

    if (canManage && pedido.estado === "pendiente") {
      const disabledAttr = stockSuficiente ? "" : "disabled title=\"Stock insuficiente para aprobar\"";
      actions.push(`<button data-action="aprobar-pedido" data-id="${pedido.id}" ${disabledAttr}>Aprobar</button>`);
      actions.push(`<button data-action="rechazar-pedido" data-id="${pedido.id}">Rechazar</button>`);
    }

    if (canManage && pedido.estado !== "entregado" && pedido.estado !== "rechazado") {
      actions.push(`<button data-action="entregar-pedido" data-id="${pedido.id}">Entregar</button>`);
    }

    if (!canManage && canCancel) {
      actions.push(`<button data-action="cancelar-pedido" data-id="${pedido.id}">Cancelar</button>`);
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${pedido.producto_nombre || "-"}</td>
      <td>${pedido.cantidad}</td>
      ${canViewStock ? `<td>${stockActual}</td>` : ""}
      <td>${pedido.institucion || "-"}</td>
      <td><span class="badge">${pedido.estado}</span></td>
      <td>${pedido.usuario_nombre || "-"}</td>
      <td>${pedido.notas || "-"}</td>
      <td>${new Date(pedido.created_at).toLocaleDateString()}</td>
      <td><div class="inline-actions">${actions.join("")}</div></td>
    `;
    pedidosTbody.appendChild(tr);
  });
}

document.getElementById("createPedidoForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const pedidosMsg = document.getElementById("pedidosMsg");
  pedidosMsg.textContent = "";

  if (!hasPermission("pedidos.create")) {
    pedidosMsg.textContent = "No tiene permiso para crear pedidos";
    return;
  }

  const payload = {
    producto_id: parseInt(document.getElementById("pedidoProductoId").value, 10),
    cantidad: parseInt(document.getElementById("pedidoCantidad").value, 10),
    notas: document.getElementById("pedidoNotas").value.trim() || null
  };

  const res = await fetch("/api/pedidos", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    pedidosMsg.textContent = data.error || "No se pudo crear el pedido";
    return;
  }

  document.getElementById("createPedidoForm").reset();
  pedidosMsg.textContent = "Pedido creado correctamente";
  await loadPedidos();
});

pedidosTbody?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const { id, action } = btn.dataset;
  if (!id || !action) return;

  const pedidosMsg = document.getElementById("pedidosMsg");
  pedidosMsg.textContent = "";

  let url = null;
  let options = null;

  if (action === "cancelar-pedido") {
    url = `/api/pedidos/${id}/cancelar`;
    options = { method: "PATCH", headers: authHeaders() };
  }

  if (action === "aprobar-pedido") {
    url = `/api/pedidos/${id}/estado`;
    options = { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ estado: "aprobado" }) };
  }

  if (action === "rechazar-pedido") {
    url = `/api/pedidos/${id}/estado`;
    options = { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ estado: "rechazado" }) };
  }

  if (action === "entregar-pedido") {
    url = `/api/pedidos/${id}/estado`;
    options = { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ estado: "entregado" }) };
  }

  if (!url || !options) return;

  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    pedidosMsg.textContent = data.error || "No se pudo actualizar el pedido";
    return;
  }

  await loadPedidos();
  await loadProductos();
  await loadMovimientos();
});

// ============ AUDITORÍA ============



// ============ INSTITUCIONES ============
const institucionesTbody = document.getElementById("institucionesTbody");
const institucionesMsg = document.getElementById("institucionesMsg");
const abrirCrearInstitucionBtn = document.getElementById("abrirCrearInstitucionBtn");
const modalCrearInstitucion = document.getElementById("modalCrearInstitucion");
const cerrarModalCrearInst = document.getElementById("cerrarModalCrearInst");
const formCrearInstitucion = document.getElementById("formCrearInstitucion");
const crearInstitucionMsg = document.getElementById("crearInstitucionMsg");

abrirCrearInstitucionBtn?.addEventListener("click", () => {
  if (modalCrearInstitucion) modalCrearInstitucion.style.display = "flex";
  if (crearInstitucionMsg) crearInstitucionMsg.textContent = "";
  formCrearInstitucion?.reset();
});

cerrarModalCrearInst?.addEventListener("click", () => {
  if (modalCrearInstitucion) modalCrearInstitucion.style.display = "none";
});

formCrearInstitucion?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!hasPermission("instituciones.create")) {
    crearInstitucionMsg.textContent = "No tiene permiso para crear instituciones";
    return;
  }
  // Validación básica
  const cue = document.getElementById("nuevoCue").value.trim();
  const cui = document.getElementById("nuevoCui").value.trim();
  const nombre = document.getElementById("nuevoNombreInst").value.trim();
  const nivel = document.getElementById("nuevoNivel").value.trim();
  const categoria = document.getElementById("nuevaCategoria").value.trim();
  const ambito = document.getElementById("nuevoAmbito").value.trim();
  const cabecera = document.getElementById("nuevoCabecera").value.trim();
  if (!cue || !cui || !nombre || !nivel || !categoria || !ambito || !cabecera) {
    crearInstitucionMsg.textContent = "Todos los campos son obligatorios";
    return;
  }
  // Enviar al backend
  const res = await fetch("/api/instituciones", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ cue, cui, nombre, nivel_educativo: nivel, categoria, ambito, establecimiento_cabecera: cabecera })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    crearInstitucionMsg.textContent = data.error || "No se pudo crear la institución";
    return;
  }
  crearInstitucionMsg.textContent = "Institución creada correctamente";
  setTimeout(() => {
    if (modalCrearInstitucion) modalCrearInstitucion.style.display = "none";
    loadInstituciones();
  }, 1000);
});

// Carga el dropdown de instituciones para el formulario de usuarios
async function loadInstitucionesDropdown() {
  const select = document.getElementById("newInstitucion");
  if (!select) return;
  
  try {
    const res = await fetch("/api/instituciones/public/list");
    const data = await res.json();
    const instituciones = data.instituciones || [];
    
    // Mantener la primera opción
    select.innerHTML = '<option value="">-- Seleccionar (obligatorio para directivo) --</option>';
    instituciones.forEach(inst => {
      const opt = document.createElement("option");
      opt.value = inst.id;
      opt.textContent = inst.nombre;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error("Error cargando instituciones:", err);
  }
}

async function loadInstituciones() {
  // Siempre cargar el dropdown para el form de usuarios
  await loadInstitucionesDropdown();
  
  if (!hasPermission("instituciones.view")) return;

  const res = await fetch("/api/instituciones", { headers: authHeaders() });
  const result = await processApiResponse(res);
  if (!result.ok) {
    if (institucionesMsg) {
      institucionesMsg.textContent = result.error === "Forbidden"
        ? "No tiene permiso para ver instituciones"
        : "No se pudieron cargar instituciones";
    }
    return;
  }

  const data = await res.json();
  state.instituciones = data.instituciones || [];
  renderInstituciones();
  populateAsigProductoSelect();
}

function renderInstituciones() {
  if (!institucionesTbody) return;
  institucionesTbody.innerHTML = "";

  const canEdit = hasPermission("instituciones.edit");
  const canDelete = hasPermission("instituciones.delete");
  const canAsignar = hasPermission("instituciones.asignar");

  state.instituciones.forEach((inst) => {
    const actions = [];
    if (canEdit) {
      actions.push(`<button data-action="edit-inst" data-id="${inst.id}">Editar</button>`);
      actions.push(`<button data-action="toggle-inst" data-id="${inst.id}" data-active="${inst.activo}">${inst.activo ? "Desactivar" : "Activar"}</button>`);
    }
    if (canAsignar) {
      actions.push(`<button data-action="ver-asignaciones" data-id="${inst.id}">Asignaciones</button>`);
    }
    if (canDelete) {
      actions.push(`<button data-action="delete-inst" data-id="${inst.id}">Eliminar</button>`);
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${inst.cue}</td>
      <td>${inst.nombre}</td>
      <td>${inst.nivel || "-"}</td>
      <td>${inst.localidad || "-"}</td>
      <td>${inst.matriculados}</td>
      <td>${inst.factor_asignacion}x</td>
      <td>${inst.activo ? "Sí" : "No"}</td>
      <td><div class="inline-actions">${actions.join("")}</div></td>
    `;
    institucionesTbody.appendChild(tr);
  });
}

function populateAsigProductoSelect() {
  const select = document.getElementById("asigProductoId");
  if (!select) return;

  select.innerHTML = '<option value="">Seleccionar producto...</option>';
  state.productos.forEach((p) => {
    const option = document.createElement("option");
    option.value = p.id;
    option.textContent = `${p.codigo} - ${p.nombre} (Stock: ${p.stock_actual})`;
    select.appendChild(option);
  });
}

// Acciones en tabla de instituciones
institucionesTbody?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const { id, action, active } = btn.dataset;
  if (!id || !action) return;

  if (action === "toggle-inst") {
    const res = await fetch(`/api/instituciones/${id}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ activo: active !== "1" })
    });
    if (res.ok) {
      await loadInstituciones();
    } else {
      const data = await res.json().catch(() => ({}));
      showMessage(institucionesMsg, data.error || "No se pudo actualizar", "error");
    }
  }

  if (action === "delete-inst") {
    if (!confirm("¿Eliminar esta institución y sus asignaciones?")) return;
    const res = await fetch(`/api/instituciones/${id}`, {
      method: "DELETE",
      headers: authHeaders()
    });
    if (res.ok) {
      await loadInstituciones();
      showMessage(institucionesMsg, "Institución eliminada", "success");
    } else {
      const data = await res.json().catch(() => ({}));
      showMessage(institucionesMsg, data.error || "No se pudo eliminar", "error");
    }
  }

  if (action === "ver-asignaciones") {
    const inst = state.instituciones.find(i => i.id === parseInt(id, 10));
    if (!inst) return;

    // Obtener asignaciones
    const res = await fetch(`/api/instituciones/${id}/asignaciones`, { headers: authHeaders() });
    if (!res.ok) {
      showMessage(institucionesMsg, "No se pudieron cargar asignaciones", "error");
      return;
    }

    const data = await res.json();
    const asignaciones = data.asignaciones || [];

    let html = `<h4>Asignaciones de ${inst.nombre} (CUE: ${inst.cue})</h4>`;
    if (asignaciones.length === 0) {
      html += "<p>No hay asignaciones registradas.</p>";
    } else {
      html += "<table><thead><tr><th>Producto</th><th>Período</th><th>Asignado</th><th>Entregado</th><th>Pendiente</th></tr></thead><tbody>";
      asignaciones.forEach(a => {
        html += `<tr>
          <td>${a.producto_nombre}</td>
          <td>${a.periodo}</td>
          <td>${a.cantidad_asignada}</td>
          <td>${a.cantidad_entregada}</td>
          <td>${a.pendiente}</td>
        </tr>`;
      });
      html += "</tbody></table>";
    }

    // Mostrar en modal simple o alert
    const modal = document.createElement("div");
    modal.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;";
    modal.innerHTML = `
      <div style="background:white;padding:24px;border-radius:8px;max-width:600px;max-height:80vh;overflow:auto;">
        ${html}
        <button onclick="this.closest('div').parentElement.remove()" style="margin-top:16px;">Cerrar</button>
      </div>
    `;
    document.body.appendChild(modal);
  }

  if (action === "edit-inst") {
    const inst = state.instituciones.find(i => i.id === parseInt(id, 10));
    if (!inst) return;

    const nuevoMatriculados = prompt(`Editar matrícula de ${inst.nombre}:`, inst.matriculados);
    if (nuevoMatriculados === null) return;

    const res = await fetch(`/api/instituciones/${id}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ matriculados: parseInt(nuevoMatriculados, 10) || 0 })
    });

    if (res.ok) {
      await loadInstituciones();
      showMessage(institucionesMsg, "Institución actualizada", "success");
    } else {
      const data = await res.json().catch(() => ({}));
      showMessage(institucionesMsg, data.error || "No se pudo actualizar", "error");
    }
  }
});

render();
