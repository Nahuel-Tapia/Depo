const state = {
  token: localStorage.getItem("token") || null,
  user: JSON.parse(localStorage.getItem("user") || "null"),
  permissions: [],
  productos: [],
  movimientos: [],
  pedidos: [],
  users: [],
  instituciones: [],
  proveedores: [],
  loteMovimientos: [], // Array de {producto_id, cantidad, nombre}
  loteEgreso: [], // Array de {producto_id, cantidad, nombre, estado}
  loteIngreso: [] // Array de {producto_id, cantidad, nombre, estado}
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
  if (!permissionsList) {
    console.log("DEBUG: permissionsList es null, saltando renderPermissions");
    return;
  }
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
  await loadProveedores();
}

function updateTabsVisibility() {
  const tabs = {
    productos: ["productos.view"],
    movimientos: ["movimientos.view"],
    pedidos: ["pedidos.view"],
    instituciones: ["instituciones.view"],
    proveedores: ["proveedores.view"],
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

// Buscar nombre de escuela por CUE y cargar modalidades
document.getElementById("registerCue")?.addEventListener("blur", async (e) => {
  const cue = e.target.value.trim();
  const escuelaField = document.getElementById("registerEscuela");
  const cueStatus = document.getElementById("cueStatus");
  const nivelContainer = document.getElementById("nivelContainer");
  const nivelSelect = document.getElementById("registerNivel");
  
  if (!cue || cue.length !== 9) {
    escuelaField.value = "";
    cueStatus.textContent = "";
    if (nivelContainer) nivelContainer.style.display = "none";
    return;
  }

  try {
    const res = await fetch(`/api/instituciones/public/cue/${cue}`);
    const data = await res.json().catch(() => ({}));
    
    if (res.ok && data.nombre) {
      escuelaField.value = data.nombre;
      cueStatus.textContent = "✓ Escuela encontrada";
      cueStatus.style.color = "#10b981";

      // Cargar modalidades en el select
      if (data.modalidades && data.modalidades.length > 1 && nivelSelect) {
        nivelSelect.innerHTML = '<option value="">Seleccione un nivel</option>';
        data.modalidades.forEach(m => {
          const opt = document.createElement("option");
          opt.value = m.nivel_educativo;
          opt.textContent = m.nivel_educativo;
          nivelSelect.appendChild(opt);
        });
        nivelContainer.style.display = "block";
      } else if (data.modalidades && data.modalidades.length === 1 && nivelSelect) {
        // Si solo hay una modalidad, seleccionarla automáticamente
        nivelSelect.innerHTML = `<option value="${data.modalidades[0].nivel_educativo}">${data.modalidades[0].nivel_educativo}</option>`;
        nivelContainer.style.display = "block";
      } else {
        nivelContainer.style.display = "none";
      }
    } else {
      escuelaField.value = "";
      cueStatus.textContent = data.error || "Escuela no encontrada";
      cueStatus.style.color = "#ef4444";
      if (nivelContainer) nivelContainer.style.display = "none";
    }
  } catch (err) {
    escuelaField.value = "";
    cueStatus.textContent = "Error al buscar escuela";
    cueStatus.style.color = "#ef4444";
    if (nivelContainer) nivelContainer.style.display = "none";
  }
});

registerForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  showMessage(registerMsg, "");

  const nombre = document.getElementById("registerNombre").value.trim();
  const cue = document.getElementById("registerCue").value.trim();
  const nivel_educativo = document.getElementById("registerNivel")?.value || "";
  const numero = document.getElementById("registerNumero").value.trim();
  const password = document.getElementById("registerPassword").value;

  if (!nivel_educativo) {
    showMessage(registerMsg, "Debe seleccionar un nivel educativo", "error");
    return;
  }

  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre, cue, nivel_educativo, numero, password })
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
    
    // Limpiar lote cuando se va a movimientos
    if (tabName === "movimientos") {
      clearLote();
      clearEgreso();
      clearIngreso();
      initSubTabs();
      loadInstitucionesDropdown();
    }
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
    { el: document.getElementById("loteProductoId"), showStock: false },
    { el: document.getElementById("egresoProductoId"), showStock: false },
    { el: document.getElementById("ingresoProductoId"), showStock: false },
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
    const institucionCargo = m.institucion_nombre && m.cargo_retira 
      ? `${m.institucion_nombre} (${m.cargo_retira})` 
      : m.institucion_nombre || m.cargo_retira || "-";
    
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${m.producto_nombre || "-"}</td>
      <td><span class="badge badge-${m.tipo}">${m.tipo}</span></td>
      <td>${m.cantidad}</td>
      <td>${m.estado_producto || "-"}</td>
      <td>${institucionCargo}</td>
      <td>${m.motivo || "-"}</td>
      <td>${m.usuario_nombre || "-"}</td>
      <td>${new Date(m.fecha_movimiento).toLocaleDateString()}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Funciones para manejar el lote de movimientos
function renderLote() {
  const tbody = document.getElementById("loteTbody");
  tbody.innerHTML = "";
  
  state.loteMovimientos.forEach((item, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="border: 1px solid #ddd; padding: 8px;">${item.nombre}</td>
      <td style="border: 1px solid #ddd; padding: 8px;">${item.cantidad}</td>
      <td style="border: 1px solid #ddd; padding: 8px;">
        <button type="button" onclick="removeFromLote(${index})" class="secondary">Remover</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function addToLote() {
  const productoId = parseInt(document.getElementById("loteProductoId").value);
  const cantidad = parseInt(document.getElementById("loteCantidad").value);
  
  if (!productoId || !cantidad || cantidad <= 0) {
    alert("Seleccione un producto y una cantidad válida");
    return;
  }
  
  // Verificar si el producto ya está en el lote
  const existing = state.loteMovimientos.find(item => item.producto_id === productoId);
  if (existing) {
    existing.cantidad += cantidad;
  } else {
    const producto = state.productos.find(p => p.id === productoId);
    state.loteMovimientos.push({
      producto_id: productoId,
      cantidad: cantidad,
      nombre: producto ? producto.nombre : "Producto desconocido"
    });
  }
  
  renderLote();
  document.getElementById("loteProductoId").value = "";
  document.getElementById("loteCantidad").value = "";
}

function removeFromLote(index) {
  state.loteMovimientos.splice(index, 1);
  renderLote();
}

function clearLote() {
  state.loteMovimientos = [];
  renderLote();
}

// Funciones para manejar sub-pestañas
function initSubTabs() {
  const subTabButtons = document.querySelectorAll(".sub-tab-btn");
  const subTabContents = document.querySelectorAll(".sub-tab-content");

  subTabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const subTabName = btn.dataset.subtab;
      
      // Actualizar botones
      subTabButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      
      // Actualizar contenido
      subTabContents.forEach(tc => tc.classList.add("hidden"));
      document.getElementById(subTabName + "SubTab").classList.remove("hidden");
    });
  });
}

// Funciones para EGRESO
function renderEgreso() {
  const tbody = document.getElementById("egresoTbody");
  tbody.innerHTML = "";
  
  state.loteEgreso.forEach((item, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="border: 1px solid #ddd; padding: 8px;">${item.nombre}</td>
      <td style="border: 1px solid #ddd; padding: 8px;">${item.cantidad}</td>
      <td style="border: 1px solid #ddd; padding: 8px;">${item.estado}</td>
      <td style="border: 1px solid #ddd; padding: 8px;">
        <button type="button" onclick="removeFromEgreso(${index})" class="secondary">Remover</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function addToEgreso() {
  const productoId = parseInt(document.getElementById("egresoProductoId").value);
  const cantidad = parseInt(document.getElementById("egresoCantidad").value);
  const estado = document.getElementById("egresoEstado").value;
  
  if (!productoId || !cantidad || cantidad <= 0) {
    alert("Seleccione un producto y una cantidad válida");
    return;
  }
  
  const producto = state.productos.find(p => p.id === productoId);
  state.loteEgreso.push({
    producto_id: productoId,
    cantidad: cantidad,
    nombre: producto ? producto.nombre : "Producto desconocido",
    estado: estado
  });
  
  renderEgreso();
  document.getElementById("egresoProductoId").value = "";
  document.getElementById("egresoCantidad").value = "";
}

function removeFromEgreso(index) {
  state.loteEgreso.splice(index, 1);
  renderEgreso();
}

function clearEgreso() {
  state.loteEgreso = [];
  renderEgreso();
}

// Funciones para INGRESO
function renderIngreso() {
  const tbody = document.getElementById("ingresoTbody");
  tbody.innerHTML = "";
  
  state.loteIngreso.forEach((item, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="border: 1px solid #ddd; padding: 8px;">${item.nombre}</td>
      <td style="border: 1px solid #ddd; padding: 8px;">${item.cantidad}</td>
      <td style="border: 1px solid #ddd; padding: 8px;">${item.estado}</td>
      <td style="border: 1px solid #ddd; padding: 8px;">
        <button type="button" onclick="removeFromIngreso(${index})" class="secondary">Remover</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function addToIngreso() {
  const productoId = parseInt(document.getElementById("ingresoProductoId").value);
  const cantidad = parseInt(document.getElementById("ingresoCantidad").value);
  const estado = document.getElementById("ingresoEstado").value;
  
  if (!productoId || !cantidad || cantidad <= 0) {
    alert("Seleccione un producto y una cantidad válida");
    return;
  }
  
  const producto = state.productos.find(p => p.id === productoId);
  state.loteIngreso.push({
    producto_id: productoId,
    cantidad: cantidad,
    nombre: producto ? producto.nombre : "Producto desconocido",
    estado: estado
  });
  
  renderIngreso();
  document.getElementById("ingresoProductoId").value = "";
  document.getElementById("ingresoCantidad").value = "";
}

function removeFromIngreso(index) {
  state.loteIngreso.splice(index, 1);
  renderIngreso();
}

function clearIngreso() {
  state.loteIngreso = [];
  renderIngreso();
}

document.getElementById("createMovimientoForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("movimientosMsg");
  msg.textContent = "";
  
  const tipo = document.getElementById("movTipo").value;
  const motivo = document.getElementById("movMotivo").value.trim() || null;
  
  if (!tipo) {
    msg.textContent = "Seleccione un tipo de movimiento";
    return;
  }
  
  if (state.loteMovimientos.length === 0) {
    msg.textContent = "Agregue al menos un producto al lote";
    return;
  }
  
  const payload = {
    tipo: tipo,
    motivo: motivo,
    productos: state.loteMovimientos.map(item => ({
      producto_id: item.producto_id,
      cantidad: item.cantidad,
      estado: "nuevo" // estado por defecto para movimientos por lote
    }))
  };
  
  const res = await fetch("/api/movimientos/directo", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  
  if (!res.ok) {
    const data = await res.json();
    msg.textContent = data.error || "Error al registrar lote de movimientos";
    return;
  }
  
  document.getElementById("createMovimientoForm").reset();
  clearLote();
  await loadMovimientos();
  await loadProductos();
});

document.getElementById("addToLoteBtn")?.addEventListener("click", addToLote);

// Event listeners para EGRESO
document.getElementById("addEgresoBtn")?.addEventListener("click", addToEgreso);

document.getElementById("createEgresoForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("movimientosMsg");
  msg.textContent = "";
  
  const institucionId = parseInt(document.getElementById("egresoInstitucion").value);
  const cargo = document.getElementById("egresoCargo").value;
  const motivo = document.getElementById("egresoMotivo").value.trim() || null;
  
  if (!institucionId || !cargo) {
    msg.textContent = "Seleccione institución y cargo";
    return;
  }
  
  if (state.loteEgreso.length === 0) {
    msg.textContent = "Agregue al menos un producto al egreso";
    return;
  }
  
  const payload = {
    tipo: "egreso",
    institucion_id: institucionId,
    cargo_retira: cargo,
    motivo: motivo,
    productos: state.loteEgreso
  };
  
  const res = await fetch("/api/movimientos/directo", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  
  if (!res.ok) {
    const data = await res.json();
    msg.textContent = data.error || "Error al registrar egreso";
    return;
  }
  
  document.getElementById("createEgresoForm").reset();
  clearEgreso();
  await loadMovimientos();
  await loadProductos();
});

// Event listeners para INGRESO
document.getElementById("addIngresoBtn")?.addEventListener("click", addToIngreso);

document.getElementById("createIngresoForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("movimientosMsg");
  msg.textContent = "";
  
  const motivo = document.getElementById("ingresoMotivo").value.trim() || null;
  
  if (state.loteIngreso.length === 0) {
    msg.textContent = "Agregue al menos un producto al ingreso";
    return;
  }
  
  const payload = {
    tipo: "ingreso",
    motivo: motivo,
    productos: state.loteIngreso
  };
  
  const res = await fetch("/api/movimientos/directo", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  
  if (!res.ok) {
    const data = await res.json();
    msg.textContent = data.error || "Error al registrar ingreso";
    return;
  }
  
  document.getElementById("createIngresoForm").reset();
  clearIngreso();
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

// Carga el dropdown de instituciones para el formulario de usuarios
async function loadInstitucionesDropdown() {
  const selects = [
    document.getElementById("newInstitucion"),
    document.getElementById("egresoInstitucion")
  ];
  
  try {
    const res = await fetch("/api/instituciones/public/list");
    const data = await res.json();
    const instituciones = data.instituciones || [];
    
    selects.forEach(select => {
      if (!select) return;
      // Mantener la primera opción
      const firstOption = select.querySelector("option")?.textContent || "Seleccionar institución...";
      select.innerHTML = `<option value="">${firstOption}</option>`;
      instituciones.forEach(inst => {
        const opt = document.createElement("option");
        opt.value = inst.id;
        opt.textContent = inst.nombre;
        select.appendChild(opt);
      });
    });
  } catch (err) {
    console.error("Error cargando instituciones:", err);
  }
}

async function loadInstituciones() {
  // Siempre cargar el dropdown para el form de usuarios
  await loadInstitucionesDropdown();
  
  if (!hasPermission("instituciones.view")) {
    return;
  }

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

function renderInstituciones(lista) {
  if (!institucionesTbody) {
    console.error("ERROR: institucionesTbody element not found");
    return;
  }
  const items = lista !== undefined ? lista : state.instituciones;
  institucionesTbody.innerHTML = "";

  const countEl = document.getElementById("institucionesCount");
  if (countEl) {
    countEl.textContent = `Mostrando ${items.length} de ${state.instituciones.length} instituciones`;
  }

  const canEdit = hasPermission("instituciones.edit");
  const canDelete = hasPermission("instituciones.delete");
  const canAsignar = hasPermission("instituciones.asignar");

  items.forEach((inst) => {
    const actions = [];
    if (canEdit) {
      actions.push(`<button data-action="edit-inst" data-id="${inst.id}">${inst.activo ? "Editar" : "Editar"}</button>`);
      actions.push(`<button data-action="toggle-inst" data-id="${inst.id}" data-active="${inst.activo}">${inst.activo ? "Desactivar" : "Activar"}</button>`);
    }
    if (canAsignar) {
      actions.push(`<button data-action="ver-asignaciones" data-id="${inst.id}">Asignaciones</button>`);
    }
    if (canDelete) {
      actions.push(`<button data-action="delete-inst" data-id="${inst.id}">Eliminar</button>`);
    }

    const direccionCompleta = [inst.direccion, inst.localidad, inst.departamento]
      .filter(Boolean).join(" - ") || "-";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${inst.id}</td>
      <td>${inst.cue}</td>
      <td>${inst.nombre.trim()}</td>
      <td>${inst.nivel || "-"}</td>
      <td>${direccionCompleta}</td>
      <td><div class="inline-actions">${actions.join("")}</div></td>
    `;
    institucionesTbody.appendChild(tr);
  });
}

// Búsqueda de institución por CUE en la tabla de instituciones
document.getElementById("btnBuscarCue")?.addEventListener("click", () => {
  const cue = (document.getElementById("buscarCue")?.value || "").trim();
  const msg = document.getElementById("institucionesMsg");
  if (!cue) {
    renderInstituciones();
    return;
  }
  const encontradas = state.instituciones.filter(i => String(i.cue).includes(cue));
  if (encontradas.length === 0) {
    if (msg) showMessage(msg, `No se encontró ninguna institución con CUE "${cue}"`, "error");
  } else {
    if (msg) showMessage(msg, "");
  }
  renderInstituciones(encontradas);
});

document.getElementById("buscarCue")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("btnBuscarCue")?.click();
});

document.getElementById("btnLimpiarCue")?.addEventListener("click", () => {
  const input = document.getElementById("buscarCue");
  if (input) input.value = "";
  const msg = document.getElementById("institucionesMsg");
  if (msg) showMessage(msg, "");
  renderInstituciones();
});

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

// ============ PROVEEDORES ============
const proveedoresTbody = document.getElementById("proveedoresTbody");
const proveedoresMsg = document.getElementById("proveedoresMsg");

async function loadProveedores() {
  if (!hasPermission("proveedores.view")) return;
  const res = await fetch("/api/proveedores", { headers: authHeaders() });
  const result = await processApiResponse(res);
  if (!result.ok) return;
  const data = await res.json();
  state.proveedores = data.proveedores || [];
  renderProveedores();
}

function renderProveedores() {
  if (!proveedoresTbody) return;
  proveedoresTbody.innerHTML = "";

  // Ocultar form si no tiene permiso de crear
  const formWrap = document.getElementById("proveedorFormWrap");
  if (formWrap) formWrap.style.display = hasPermission("proveedores.create") ? "" : "none";

  if (state.proveedores.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="6" style="text-align:center; color:#9ca3af; padding:32px;">No hay proveedores registrados</td>`;
    proveedoresTbody.appendChild(tr);
    return;
  }

  const canEdit = hasPermission("proveedores.edit");
  const canDelete = hasPermission("proveedores.delete");

  state.proveedores.forEach((p) => {
    const tr = document.createElement("tr");
    tr.dataset.id = p.id;
    tr.innerHTML = `
      <td><strong>${p.nombre}</strong><br><small style="color:#6b7280">${p.cuit || ""}</small></td>
      <td>${p.contacto || "-"}</td>
      <td>${p.telefono || "-"}</td>
      <td>${p.email || "-"}</td>
      <td>${p.categoria || "-"}</td>
      <td>
        <div class="inline-actions">
          ${canEdit ? `<button data-action="edit-prov" data-id="${p.id}" title="Editar" style="padding:6px 10px;">✏️</button>` : ""}
          ${canDelete ? `<button data-action="delete-prov" data-id="${p.id}" title="Eliminar" style="padding:6px 10px; background:#ef4444;">🗑️</button>` : ""}
        </div>
      </td>
    `;
    proveedoresTbody.appendChild(tr);
  });
}

// Crear proveedor
document.getElementById("createProveedorForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  showMessage(proveedoresMsg, "");

  const payload = {
    nombre: document.getElementById("provNombre").value.trim(),
    cuit: document.getElementById("provCuit").value.trim() || null,
    contacto: document.getElementById("provContacto").value.trim() || null,
    telefono: document.getElementById("provTelefono").value.trim() || null,
    email: document.getElementById("provEmail").value.trim() || null,
    categoria: document.getElementById("provCategoria").value.trim() || null
  };

  const res = await fetch("/api/proveedores", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    showMessage(proveedoresMsg, data.error || "No se pudo crear el proveedor", "error");
    return;
  }

  document.getElementById("createProveedorForm").reset();
  document.getElementById("proveedorFormWrap").removeAttribute("open");
  showMessage(proveedoresMsg, "Proveedor creado correctamente", "success");
  await loadProveedores();
});

// Editar / Eliminar desde tabla
proveedoresTbody?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (!action || !id) return;

  if (action === "delete-prov") {
    if (!confirm("\u00bfEliminar este proveedor?")) return;
    const res = await fetch(`/api/proveedores/${id}`, { method: "DELETE", headers: authHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showMessage(proveedoresMsg, data.error || "No se pudo eliminar", "error");
      return;
    }
    showMessage(proveedoresMsg, "Proveedor eliminado", "success");
    await loadProveedores();
  }

  if (action === "edit-prov") {
    const prov = state.proveedores.find(p => String(p.id) === String(id));
    if (!prov) return;

    // Modal inline de edici\u00f3n
    const existing = document.getElementById("editProvModal");
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.id = "editProvModal";
    modal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:1000;";
    modal.innerHTML = `
      <div style="background:white;padding:28px;border-radius:10px;min-width:380px;max-width:520px;width:90%;">
        <h3 style="margin-bottom:20px;">Editar proveedor</h3>
        <div class="grid" style="gap:12px;">
          <div><label>Empresa *</label><input id="ep_nombre" value="${prov.nombre}" style="width:100%;" /></div>
          <div><label>CUIT</label><input id="ep_cuit" value="${prov.cuit || ""}" style="width:100%;" /></div>
          <div><label>Contacto</label><input id="ep_contacto" value="${prov.contacto || ""}" style="width:100%;" /></div>
          <div><label>Tel\u00e9fono</label><input id="ep_telefono" value="${prov.telefono || ""}" style="width:100%;" /></div>
          <div><label>Email</label><input id="ep_email" value="${prov.email || ""}" style="width:100%;" /></div>
          <div><label>Categor\u00eda</label><input id="ep_categoria" value="${prov.categoria || ""}" style="width:100%;" /></div>
        </div>
        <div style="display:flex;gap:10px;margin-top:20px;justify-content:flex-end;">
          <button id="ep_cancel" class="secondary">Cancelar</button>
          <button id="ep_save">Guardar cambios</button>
        </div>
        <div id="ep_msg" class="msg" style="margin-top:10px;"></div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById("ep_cancel").onclick = () => modal.remove();
    modal.addEventListener("click", (ev) => { if (ev.target === modal) modal.remove(); });

    document.getElementById("ep_save").onclick = async () => {
      const payload = {
        nombre: document.getElementById("ep_nombre").value.trim(),
        cuit: document.getElementById("ep_cuit").value.trim() || null,
        contacto: document.getElementById("ep_contacto").value.trim() || null,
        telefono: document.getElementById("ep_telefono").value.trim() || null,
        email: document.getElementById("ep_email").value.trim() || null,
        categoria: document.getElementById("ep_categoria").value.trim() || null
      };
      if (!payload.nombre) {
        document.getElementById("ep_msg").textContent = "El nombre es obligatorio";
        return;
      }
      const res = await fetch(`/api/proveedores/${id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        document.getElementById("ep_msg").textContent = data.error || "No se pudo guardar";
        return;
      }
      modal.remove();
      showMessage(proveedoresMsg, "Proveedor actualizado", "success");
      await loadProveedores();
    };
  }
});

render();

// ============ MODALES ============
function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add("hidden");
    document.body.style.overflow = "";
  }
}

document.getElementById("btnAgregarProducto")?.addEventListener("click", () => openModal("modalProducto"));
document.getElementById("closeModalProducto")?.addEventListener("click", () => closeModal("modalProducto"));
document.getElementById("cancelModalProducto")?.addEventListener("click", () => closeModal("modalProducto"));
document.getElementById("modalProducto")?.addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeModal("modalProducto");
});

document.getElementById("btnAgregarProveedor")?.addEventListener("click", () => openModal("modalProveedor"));
document.getElementById("closeModalProveedor")?.addEventListener("click", () => closeModal("modalProveedor"));
document.getElementById("cancelModalProveedor")?.addEventListener("click", () => closeModal("modalProveedor"));
document.getElementById("modalProveedor")?.addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeModal("modalProveedor");
});
