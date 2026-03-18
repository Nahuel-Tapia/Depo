const express = require("express");
const { authenticate } = require("../middleware/auth");
const { ROLE_PERMISSIONS, getPermissionsForRole } = require("../permissions");

const router = express.Router();
router.use(authenticate);

router.get("/me", (req, res) => {
  const role = req.user.role;
  return res.json({
    role,
    permissions: getPermissionsForRole(role)
  });
});

router.get("/matrix", (req, res) => {
  return res.json({
    matrix: ROLE_PERMISSIONS
  });
});

module.exports = router;
