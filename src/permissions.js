const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard.view",
  STOCK_VIEW: "stock.view",
  STOCK_EDIT: "stock.edit",
  STOCK_MOVEMENT_CREATE: "stock.movement.create",
  USERS_READ: "users.read",
  USERS_CREATE: "users.create",
  USERS_ROLE_UPDATE: "users.role.update",
  USERS_STATUS_UPDATE: "users.status.update"
};

const ROLE_PERMISSIONS = {
  admin: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.STOCK_VIEW,
    PERMISSIONS.STOCK_EDIT,
    PERMISSIONS.STOCK_MOVEMENT_CREATE,
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_CREATE,
    PERMISSIONS.USERS_ROLE_UPDATE,
    PERMISSIONS.USERS_STATUS_UPDATE
  ],
  operador: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.STOCK_VIEW,
    PERMISSIONS.STOCK_EDIT,
    PERMISSIONS.STOCK_MOVEMENT_CREATE
  ],
  consulta: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.STOCK_VIEW]
};

function getPermissionsForRole(role) {
  return ROLE_PERMISSIONS[role] || [];
}

function hasPermission(role, permission) {
  return getPermissionsForRole(role).includes(permission);
}

module.exports = {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  getPermissionsForRole,
  hasPermission
};
