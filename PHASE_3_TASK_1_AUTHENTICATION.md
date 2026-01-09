# Phase 3 Task 1: JWT Authentication & Authorization Implementation Guide

## Overview

You currently have **Cognito-based authentication** middleware in place. Task 1 involves enhancing and completing the JWT authentication system to support:

1. ✅ **Cognito Verification** (already present)
2. ✅ **Authorization/RBAC** (already present)
3. 🔄 **JWT Token Generation for Testing** (needs implementation)
4. 🔄 **Protected Composition Endpoints** (partial)
5. 🔄 **Token Refresh Logic** (needs implementation)
6. 🔄 **Frontend Token Management** (needs implementation)

---

## Current Authentication Stack

### Backend Status

| Component | Status | Location |
|-----------|--------|----------|
| Cognito JWT Verification | ✅ Complete | [src/middleware/auth.js](src/middleware/auth.js) |
| Group-based Authorization | ✅ Complete | [src/middleware/auth.js](src/middleware/auth.js) |
| Optional Auth Middleware | ✅ Complete | [src/middleware/auth.js](src/middleware/auth.js) |
| RBAC Middleware | ✅ Complete | [src/middleware/rbac.js](src/middleware/rbac.js) |
| Routes Protected | ⚠️ Partial | [src/routes/compositions.js](src/routes/compositions.js) |
| Test/Dev Token Generation | ❌ Missing | Need to create |
| Token Refresh Endpoint | ❌ Missing | Need to create |

### Environment Configuration Status

```dotenv
# ✅ Already Set
COGNITO_USER_POOL_ID=us-east-1_mFVU52978
COGNITO_CLIENT_ID=lgtf3odnar8c456iehqfck1au
COGNITO_CLIENT_SECRET=client_secret_from_cognito
COGNITO_REGION=us-east-1

# 🔄 Need to Add
JWT_SECRET=<generate-with-crypto>
JWT_EXPIRY=7d
JWT_REFRESH_EXPIRY=30d
TOKEN_ISSUER=episode-metadata-api-dev
```

---

## Implementation Steps

### Step 1: Generate JWT Secret & Update .env

**Add JWT credentials to `.env`:**

```bash
# Generate a strong JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Add to `.env`:**

```dotenv
# JWT Configuration
JWT_SECRET=<output-from-above-command>
JWT_EXPIRY=7d
JWT_REFRESH_EXPIRY=30d
TOKEN_ISSUER=episode-metadata-api-dev
TOKEN_AUDIENCE=episode-metadata-client-dev
```

### Step 2: Create JWT Token Service

Create a new file: [src/services/tokenService.js](src/services/tokenService.js)

```javascript
/**
 * Token Service
 * Handles JWT token generation, validation, and refresh
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class TokenService {
  /**
   * Generate a JWT token for a user
   * @param {object} user - User object with id, email, etc.
   * @param {string} type - 'access' or 'refresh'
   * @returns {string} JWT token
   */
  static generateToken(user, type = 'access') {
    const secret = process.env.JWT_SECRET;
    const expiresIn = type === 'refresh' 
      ? process.env.JWT_REFRESH_EXPIRY 
      : process.env.JWT_EXPIRY;

    const payload = {
      sub: user.id || user.userId,
      email: user.email,
      name: user.name || user.email.split('@')[0],
      groups: user.groups || [],
      role: user.role || 'USER',
      type, // 'access' or 'refresh'
      iat: Math.floor(Date.now() / 1000),
    };

    const token = jwt.sign(payload, secret, {
      expiresIn,
      issuer: process.env.TOKEN_ISSUER,
      audience: process.env.TOKEN_AUDIENCE,
      algorithm: 'HS256',
    });

    return token;
  }

  /**
   * Generate both access and refresh tokens
   * @param {object} user - User object
   * @returns {object} { accessToken, refreshToken, expiresIn }
   */
  static generateTokenPair(user) {
    const accessToken = this.generateToken(user, 'access');
    const refreshToken = this.generateToken(user, 'refresh');

    // Decode to get expiry
    const decoded = jwt.decode(accessToken);
    const expiresIn = decoded.exp * 1000 - Date.now();

    return {
      accessToken,
      refreshToken,
      expiresIn,
      tokenType: 'Bearer',
    };
  }

  /**
   * Verify a JWT token
   * @param {string} token - JWT token to verify
   * @returns {object} Decoded token payload
   */
  static verifyToken(token, type = 'access') {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: process.env.TOKEN_ISSUER,
        audience: process.env.TOKEN_AUDIENCE,
        algorithms: ['HS256'],
      });

      // Verify token type if specified
      if (type && decoded.type !== type) {
        throw new Error(`Invalid token type. Expected: ${type}, Got: ${decoded.type}`);
      }

      return decoded;
    } catch (error) {
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }

  /**
   * Refresh an access token using a refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {object} New { accessToken, expiresIn }
   */
  static refreshAccessToken(refreshToken) {
    try {
      const decoded = this.verifyToken(refreshToken, 'refresh');

      const newAccessToken = this.generateToken(
        {
          id: decoded.sub,
          email: decoded.email,
          name: decoded.name,
          groups: decoded.groups,
          role: decoded.role,
        },
        'access'
      );

      const decodedAccess = jwt.decode(newAccessToken);
      const expiresIn = decodedAccess.exp * 1000 - Date.now();

      return {
        accessToken: newAccessToken,
        expiresIn,
        tokenType: 'Bearer',
      };
    } catch (error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  /**
   * Generate a test token for development
   * Useful for testing without Cognito
   * @param {object} overrides - Override default test user properties
   * @returns {object} { token, user, expiresAt }
   */
  static generateTestToken(overrides = {}) {
    const testUser = {
      id: 'test-user-' + crypto.randomBytes(8).toString('hex'),
      email: overrides.email || 'test@episode-metadata.dev',
      name: overrides.name || 'Test User',
      groups: overrides.groups || ['USER', 'EDITOR'],
      role: overrides.role || 'USER',
      ...overrides,
    };

    const { accessToken, refreshToken, expiresIn } = this.generateTokenPair(testUser);
    const decoded = jwt.decode(accessToken);

    return {
      accessToken,
      refreshToken,
      user: testUser,
      expiresAt: new Date(decoded.exp * 1000),
      expiresIn,
    };
  }
}

module.exports = TokenService;
```

### Step 3: Update JWT Authentication Middleware

Create a new file: [src/middleware/jwtAuth.js](src/middleware/jwtAuth.js)

This middleware handles both Cognito and JWT verification:

```javascript
/**
 * JWT Authentication Middleware
 * Supports both AWS Cognito and custom JWT tokens
 */

const jwt = require('jsonwebtoken');
const TokenService = require('../services/tokenService');

/**
 * Authenticate using JWT token (custom or Cognito)
 * Tries JWT first, falls back to Cognito
 */
const authenticateJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing authorization header',
        code: 'AUTH_MISSING_TOKEN',
      });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid authorization header format. Use: Bearer <token>',
        code: 'AUTH_INVALID_FORMAT',
      });
    }

    const token = parts[1];

    try {
      // Try to verify as JWT token first
      const decoded = TokenService.verifyToken(token);

      req.user = {
        id: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        groups: decoded.groups || [],
        role: decoded.role || 'USER',
        tokenType: 'jwt',
        source: 'jwt',
        expiresAt: new Date(decoded.exp * 1000),
      };

      return next();
    } catch (jwtError) {
      // JWT verification failed, could try Cognito here
      // For now, just fail
      return res.status(401).json({
        error: 'Unauthorized',
        message: jwtError.message,
        code: 'AUTH_INVALID_TOKEN',
      });
    }
  } catch (error) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication middleware error',
      code: 'AUTH_ERROR',
    });
  }
};

/**
 * Optional JWT Authentication
 * Token is optional; user info attached if valid
 */
const optionalJWTAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      req.user = null;
      return next();
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      req.user = null;
      return next();
    }

    const token = parts[1];

    try {
      const decoded = TokenService.verifyToken(token);
      req.user = {
        id: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        groups: decoded.groups || [],
        role: decoded.role || 'USER',
        tokenType: 'jwt',
        source: 'jwt',
        expiresAt: new Date(decoded.exp * 1000),
      };
    } catch (error) {
      console.warn('Optional JWT auth failed:', error.message);
      req.user = null;
    }

    next();
  } catch (error) {
    console.error('Optional JWT auth error:', error);
    req.user = null;
    next();
  }
};

/**
 * Require user to be in a specific group
 * @param {string|string[]} requiredGroups
 */
const requireGroup = (requiredGroups) => {
  const groups = Array.isArray(requiredGroups) ? requiredGroups : [requiredGroups];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
        code: 'AUTH_REQUIRED',
      });
    }

    if (!req.user.groups || !req.user.groups.some(g => groups.includes(g))) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `User must be in one of these groups: ${groups.join(', ')}`,
        code: 'AUTH_GROUP_REQUIRED',
      });
    }

    next();
  };
};

/**
 * Require user to have a specific role
 * @param {string|string[]} requiredRoles
 */
const requireRole = (requiredRoles) => {
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
        code: 'AUTH_REQUIRED',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `User must have one of these roles: ${roles.join(', ')}`,
        code: 'AUTH_ROLE_REQUIRED',
      });
    }

    next();
  };
};

module.exports = {
  authenticateJWT,
  optionalJWTAuth,
  requireGroup,
  requireRole,
};
```

### Step 4: Create Authentication Routes

Create a new file: [src/routes/auth.js](src/routes/auth.js)

```javascript
/**
 * Authentication Routes
 * Handles login, token refresh, and token validation
 */

const express = require('express');
const router = express.Router();
const TokenService = require('../services/tokenService');
const { authenticateJWT } = require('../middleware/jwtAuth');

/**
 * POST /api/v1/auth/login
 * Developer/test endpoint to get a JWT token
 * In production, this would integrate with Cognito
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password, groups, role } = req.body;

    // Validate email
    if (!email || !email.includes('@')) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Valid email required',
        code: 'AUTH_INVALID_EMAIL',
      });
    }

    // For development: accept any password (in production, verify against Cognito)
    if (!password || password.length < 6) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Password must be at least 6 characters',
        code: 'AUTH_INVALID_PASSWORD',
      });
    }

    // Generate token pair
    const user = {
      email,
      name: email.split('@')[0],
      groups: groups || ['USER', 'EDITOR'],
      role: role || 'USER',
    };

    const tokens = TokenService.generateTokenPair(user);

    // Store refresh token in secure httpOnly cookie (optional)
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenType: tokens.tokenType,
        expiresIn: tokens.expiresIn,
        user: {
          email: user.email,
          name: user.name,
          groups: user.groups,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      code: 'AUTH_LOGIN_ERROR',
    });
  }
});

/**
 * POST /api/v1/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Refresh token required',
        code: 'AUTH_MISSING_REFRESH_TOKEN',
      });
    }

    const newTokens = TokenService.refreshAccessToken(refreshToken);

    return res.status(200).json({
      success: true,
      message: 'Token refreshed',
      data: {
        accessToken: newTokens.accessToken,
        tokenType: newTokens.tokenType,
        expiresIn: newTokens.expiresIn,
      },
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return res.status(401).json({
      error: 'Unauthorized',
      message: error.message,
      code: 'AUTH_REFRESH_FAILED',
    });
  }
});

/**
 * POST /api/v1/auth/test-token
 * Generate a test token for development
 * Remove or secure this in production!
 */
router.post('/test-token', async (req, res) => {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Test tokens not available in production',
        code: 'AUTH_TEST_NOT_ALLOWED',
      });
    }

    const { email, groups, role } = req.body;

    const testToken = TokenService.generateTestToken({
      email: email || 'test@episode-metadata.dev',
      groups: groups || ['USER', 'EDITOR'],
      role: role || 'USER',
    });

    return res.status(200).json({
      success: true,
      message: 'Test token generated',
      data: testToken,
    });
  } catch (error) {
    console.error('Test token generation error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      code: 'AUTH_TEST_TOKEN_ERROR',
    });
  }
});

/**
 * GET /api/v1/auth/me
 * Get current authenticated user
 */
router.get('/me', authenticateJWT, (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: 'User information retrieved',
      data: {
        user: req.user,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      code: 'AUTH_GET_USER_ERROR',
    });
  }
});

/**
 * POST /api/v1/auth/validate
 * Validate a JWT token
 */
router.post('/validate', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Token required',
        code: 'AUTH_MISSING_TOKEN',
      });
    }

    const TokenService = require('../services/tokenService');
    const decoded = TokenService.verifyToken(token);

    return res.status(200).json({
      success: true,
      message: 'Token is valid',
      data: {
        valid: true,
        expiresAt: new Date(decoded.exp * 1000),
        user: {
          id: decoded.sub,
          email: decoded.email,
          name: decoded.name,
          groups: decoded.groups,
          role: decoded.role,
        },
      },
    });
  } catch (error) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Token is invalid',
      code: 'AUTH_INVALID_TOKEN',
      data: { valid: false },
    });
  }
});

module.exports = router;
```

### Step 5: Register Auth Routes in app.js

Update [src/app.js](src/app.js) to include the auth routes:

Find this section (around line 140):
```javascript
// API ROUTES

let episodeRoutes, thumbnailRoutes, metadataRoutes, processingRoutes;
```

Add auth routes before other routes:
```javascript
// AUTHENTICATION ROUTES
const authRoutes = require('./routes/auth');
app.use('/api/v1/auth', authRoutes);

// API ROUTES

let episodeRoutes, thumbnailRoutes, metadataRoutes, processingRoutes;
```

### Step 6: Secure Composition Endpoints

Update [src/routes/compositions.js](src/routes/compositions.js) to require authentication:

```javascript
// At the top, add:
const { authenticateJWT, requireGroup } = require('../middleware/jwtAuth');

// Then update these endpoints:

// ✅ POST / - Create composition (requires authentication)
router.post('/', authenticateJWT, async (req, res) => {
  try {
    // ... existing code ...
    
    // Store user ID with composition
    const compositionData = {
      ...req.body,
      createdBy: req.user.id,
      createdByEmail: req.user.email,
    };
    
    // ... rest of creation logic ...
  } catch (error) {
    // ... error handling ...
  }
});

// ✅ PUT /:id/approve - Publish/Approve composition (requires ADMIN group)
router.put('/:id/approve', authenticateJWT, requireGroup('ADMIN'), async (req, res) => {
  // ... existing code ...
});

// ✅ DELETE /:id - Delete composition (requires authentication + ownership check)
router.delete('/:id', authenticateJWT, async (req, res) => {
  try {
    const composition = await db.models.ThumbnailComposition.findByPk(req.params.id);
    
    if (!composition) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Composition not found',
      });
    }

    // Check ownership (allow ADMIN or owner)
    if (composition.createdBy !== req.user.id && !req.user.groups.includes('ADMIN')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only delete your own compositions',
        code: 'AUTH_OWNERSHIP_REQUIRED',
      });
    }

    // ... rest of deletion logic ...
  } catch (error) {
    // ... error handling ...
  }
});
```

### Step 7: Frontend Token Management

Update [src/components/ThumbnailComposer.jsx](src/components/ThumbnailComposer.jsx) to handle JWT authentication:

Add at the top of the component:

```javascript
// JWT Token Management
const useAuthToken = () => {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    // Load token from localStorage on mount
    const savedToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    
    if (savedToken) {
      try {
        const decoded = JSON.parse(atob(savedToken.split('.')[1]));
        const expiresAt = new Date(decoded.exp * 1000);
        
        if (expiresAt < new Date()) {
          // Token expired - try to refresh
          if (refreshToken) {
            refreshAccessToken(refreshToken);
          } else {
            clearAuth();
          }
        } else {
          setToken(savedToken);
          setUser({
            id: decoded.sub,
            email: decoded.email,
            name: decoded.name,
            groups: decoded.groups,
          });
        }
      } catch (error) {
        console.error('Token decode error:', error);
        clearAuth();
      }
    }
  }, []);

  const clearAuth = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setToken(null);
    setUser(null);
    setIsExpired(false);
  };

  const refreshAccessToken = async (refreshToken) => {
    try {
      const response = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        const newAccessToken = data.data.accessToken;
        
        localStorage.setItem('accessToken', newAccessToken);
        setToken(newAccessToken);
        
        // Decode new token
        const decoded = JSON.parse(atob(newAccessToken.split('.')[1]));
        setUser({
          id: decoded.sub,
          email: decoded.email,
          name: decoded.name,
          groups: decoded.groups,
        });
      } else {
        clearAuth();
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      clearAuth();
    }
  };

  const login = async (email, password) => {
    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        const { accessToken, refreshToken, user: userData } = data.data;
        
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        setToken(accessToken);
        setUser(userData);
        
        return { success: true, user: userData };
      } else {
        const error = await response.json();
        return { success: false, error: error.message };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  };

  return {
    token,
    user,
    isAuthenticated: !!token,
    isExpired,
    login,
    clearAuth,
    refreshAccessToken,
  };
};
```

Update API calls to include token:

```javascript
// Before: const response = await fetch(url, { method: 'POST', ... });
// After:
const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`, // Add this line
  },
  body: JSON.stringify(data),
});
```

---

## Testing the Implementation

### 1. Test JWT Generation (Development)

```bash
# Get a test token
curl -X POST http://localhost:3002/api/v1/auth/test-token \
  -H "Content-Type: application/json"

# Response:
{
  "success": true,
  "message": "Test token generated",
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "user": { "id": "...", "email": "test@...", ... }
  }
}
```

### 2. Test Login Endpoint

```bash
# Login with credentials
curl -X POST http://localhost:3002/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "groups": ["USER", "EDITOR"],
    "role": "USER"
  }'
```

### 3. Test Token Validation

```bash
# Validate a token
curl -X POST http://localhost:3002/api/v1/auth/validate \
  -H "Content-Type: application/json" \
  -d '{"token": "eyJhbGc..."}'
```

### 4. Test Protected Endpoints

```bash
# Create composition with authentication
curl -X POST http://localhost:3002/api/v1/compositions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGc..." \
  -d '{
    "episodeId": 1,
    "assets": { ... }
  }'

# Expected: 201 Created
# Without token: 401 Unauthorized
```

### 5. Test Token Refresh

```bash
# Refresh access token
curl -X POST http://localhost:3002/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "eyJhbGc..."}'
```

---

## Frontend Integration Checklist

### Authentication Flow

- [ ] Create login form component
- [ ] Add useAuthToken hook to ThumbnailComposer
- [ ] Store tokens in localStorage
- [ ] Add Authorization header to all API calls
- [ ] Implement token refresh on 401 responses
- [ ] Handle token expiration gracefully
- [ ] Add logout functionality
- [ ] Display user info in header/profile

### Code Changes Required

**File**: [src/components/ThumbnailComposer.jsx](src/components/ThumbnailComposer.jsx)

1. Import and initialize `useAuthToken` hook
2. Update all `fetch()` calls to include `Authorization` header
3. Handle 401 responses with token refresh
4. Add login/logout UI buttons
5. Display current user info

Example integration:
```javascript
const { token, user, login, logout } = useAuthToken();

// In API calls:
fetch(`/api/v1/compositions`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify(compositionData),
});
```

---

## Security Best Practices

### ✅ Implemented

- [x] JWT tokens with expiration
- [x] Separate access/refresh token pairs
- [x] HTTPS recommended (check Helmet middleware)
- [x] CORS configured (check app.js)
- [x] Role-based access control (RBAC)
- [x] Group-based authorization

### 🔄 To Implement

- [ ] Refresh token rotation (invalidate old tokens)
- [ ] Token blacklist/revocation on logout
- [ ] Rate limiting on auth endpoints
- [ ] Audit logging for auth events
- [ ] Secure httpOnly cookies for refresh tokens
- [ ] CSRF protection
- [ ] Input validation/sanitization

### Production Checklist

- [ ] Remove `/api/v1/auth/test-token` endpoint
- [ ] Implement proper Cognito integration
- [ ] Enable HTTPS
- [ ] Set secure CORS origins
- [ ] Implement rate limiting
- [ ] Add audit logging
- [ ] Use environment variables for all secrets
- [ ] Test token expiration edge cases

---

## Files to Create/Modify

### New Files to Create

| File | Purpose |
|------|---------|
| [src/services/tokenService.js](src/services/tokenService.js) | JWT token generation and validation |
| [src/middleware/jwtAuth.js](src/middleware/jwtAuth.js) | JWT authentication middleware |
| [src/routes/auth.js](src/routes/auth.js) | Authentication endpoints |

### Files to Modify

| File | Changes |
|------|---------|
| [.env](.env) | Add JWT_SECRET, JWT_EXPIRY, TOKEN_ISSUER |
| [src/app.js](src/app.js) | Register auth routes |
| [src/routes/compositions.js](src/routes/compositions.js) | Protect endpoints with auth |
| [src/components/ThumbnailComposer.jsx](src/components/ThumbnailComposer.jsx) | Add token management and auth header |

---

## Dependencies

Make sure these are installed (should already be present):

```bash
npm list jsonwebtoken dotenv express cors
```

If missing:
```bash
npm install jsonwebtoken  # For JWT signing/verification
```

---

## Troubleshooting

### Issue: "Token verification failed"
- Check JWT_SECRET is set in .env
- Verify token format (should have 3 parts separated by dots)
- Check token hasn't expired

### Issue: 401 Unauthorized on protected endpoints
- Verify Authorization header is present
- Check token is valid (use `/api/v1/auth/validate`)
- Ensure token is in "Bearer <token>" format

### Issue: CORS errors
- Check ALLOWED_ORIGINS in .env
- Verify frontend is making requests from allowed origin
- Check Content-Type headers

### Issue: Token refresh failing
- Ensure refresh token is valid
- Check refresh token hasn't expired
- Verify JWT_SECRET and TOKEN_ISSUER match

---

## Next Steps

After completing Task 1:

1. ✅ **Task 1 Complete** - JWT Authentication implemented
2. **Task 2** - Sharp Image Processing setup (resizing, cropping, watermarking)
3. **Task 3** - S3 Upload Integration (upload compositions to AWS S3)
4. **Task 4** - Runway ML Integration (background removal)
5. **Task 5** - Testing & QA (E2E workflow tests)
6. **Task 6** - Documentation (API docs, user guides)

---

## Quick Reference

### Key Environment Variables

```dotenv
JWT_SECRET=<crypto-generated-32-byte-hex>
JWT_EXPIRY=7d
JWT_REFRESH_EXPIRY=30d
TOKEN_ISSUER=episode-metadata-api-dev
TOKEN_AUDIENCE=episode-metadata-client-dev
```

### Key Endpoints

```
POST   /api/v1/auth/login           - Login (dev)
POST   /api/v1/auth/test-token      - Generate test token (dev only)
POST   /api/v1/auth/refresh         - Refresh access token
POST   /api/v1/auth/validate        - Validate a token
GET    /api/v1/auth/me              - Get current user

GET    /api/v1/compositions         - List compositions
POST   /api/v1/compositions         - Create composition (requires auth)
PUT    /api/v1/compositions/:id     - Update composition (requires auth)
DELETE /api/v1/compositions/:id     - Delete composition (requires auth)
```

### Key Classes/Functions

- `TokenService` - Handle all JWT operations
- `authenticateJWT` - Middleware for required auth
- `optionalJWTAuth` - Middleware for optional auth
- `requireGroup` - Middleware for group authorization
- `useAuthToken` - React hook for frontend auth

---

**Status**: Task 1 Ready for Implementation ✅

**Estimated Time**: 2-3 hours
