/**
 * RBAC (Role-Based Access Control) Middleware
 * Enforces role-based permissions for API endpoints
 */

/**
 * Role hierarchy and permissions
 * Admin > Editor > Viewer
 */
const ROLES = {
  admin: 'admin',
  editor: 'editor',
  viewer: 'viewer',
};

const PERMISSIONS = {
  [ROLES.admin]: {
    episodes: ['view', 'create', 'edit', 'delete', 'manage'],
    thumbnails: ['view', 'create', 'edit', 'delete', 'manage'],
    metadata: ['view', 'create', 'edit', 'delete', 'manage'],
    processing: ['view', 'create', 'edit', 'delete', 'manage'],
    activity: ['view'],
  },
  [ROLES.editor]: {
    episodes: ['view', 'create', 'edit'],
    thumbnails: ['view', 'create', 'edit'],
    metadata: ['view', 'create', 'edit'],
    processing: ['view', 'create', 'edit'],
    activity: ['view'],
  },
  [ROLES.viewer]: {
    episodes: ['view'],
    thumbnails: ['view'],
    metadata: ['view'],
    processing: ['view'],
    activity: ['view'],
  },
};

/**
 * Extract user role from Cognito groups
 */
const getUserRole = (user) => {
  if (!user || !user.groups || user.groups.length === 0) {
    return ROLES.viewer; // Default to viewer
  }

  // Check groups in order of privilege
  if (user.groups.includes('admin') || user.groups.includes('Admin')) {
    return ROLES.admin;
  }

  if (user.groups.includes('editor') || user.groups.includes('Editor')) {
    return ROLES.editor;
  }

  return ROLES.viewer; // Default fallback
};

/**
 * Check if user has required permission
 */
const hasPermission = (user, resource, action) => {
  const role = getUserRole(user);
  const rolePerms = PERMISSIONS[role];

  if (!rolePerms || !rolePerms[resource]) {
    return false;
  }

  return rolePerms[resource].includes(action);
};

/**
 * Authorize user with required roles (OR logic)
 * @param {string|string[]} allowedRoles - Role(s) required
 */
const authorize = (allowedRoles) => {
  const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  
  return (req, res, next) => {
    if (!req.user) {
      return res.status(403).json({
        error: 'UNAUTHORIZED',
        message: 'User not authenticated',
      });
    }

    const userRole = getUserRole(req.user);
    const hasRole = rolesArray.includes(userRole);

    if (!hasRole) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: `User role '${userRole}' does not have access to this resource`,
        required_roles: rolesArray,
      });
    }

    next();
  };
};

/**
 * Require specific role
 * @param {string} requiredRole - Role required (admin, editor, viewer)
 */
const requireRole = (requiredRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
        code: 'RBAC_AUTH_REQUIRED',
      });
    }

    const userRole = getUserRole(req.user);
    const roleHierarchy = {
      [ROLES.admin]: 3,
      [ROLES.editor]: 2,
      [ROLES.viewer]: 1,
    };

    const userLevel = roleHierarchy[userRole];
    const requiredLevel = roleHierarchy[requiredRole];

    if (userLevel < requiredLevel) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `This operation requires ${requiredRole} role`,
        code: 'RBAC_INSUFFICIENT_ROLE',
        userRole,
        requiredRole,
      });
    }

    // Attach role info to request
    req.rbac = {
      role: userRole,
      hasPermission: (resource, action) => hasPermission(req.user, resource, action),
    };

    next();
  };
};

/**
 * Require specific permission
 * @param {string} resource - Resource type (episodes, thumbnails, etc.)
 * @param {string} action - Action type (view, create, edit, delete, manage)
 */
const requirePermission = (resource, action) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
        code: 'RBAC_AUTH_REQUIRED',
      });
    }

    if (!hasPermission(req.user, resource, action)) {
      const userRole = getUserRole(req.user);
      return res.status(403).json({
        error: 'Forbidden',
        message: `${userRole} role cannot ${action} ${resource}`,
        code: 'RBAC_INSUFFICIENT_PERMISSION',
        resource,
        action,
        userRole,
      });
    }

    // Attach role info to request
    req.rbac = {
      role: getUserRole(req.user),
      hasPermission: (res, act) => hasPermission(req.user, res, act),
    };

    next();
  };
};

/**
 * Attach RBAC info to request (always succeeds)
 */
const attachRBAC = (req, res, next) => {
  if (req.user) {
    req.rbac = {
      role: getUserRole(req.user),
      hasPermission: (resource, action) => hasPermission(req.user, resource, action),
    };
  } else {
    req.rbac = {
      role: ROLES.viewer,
      hasPermission: () => false,
    };
  }

  next();
};

module.exports = {
  ROLES,
  PERMISSIONS,
  getUserRole,
  hasPermission,
  authorize,
  requireRole,
  requirePermission,
  attachRBAC,
};
