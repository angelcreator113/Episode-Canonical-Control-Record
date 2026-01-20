/**
 * Request Validation Middleware
 * Validates incoming request data (body, params, query)
 * Prevents injection attacks and ensures data integrity
 */

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validateUUID = (uuid) => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

const sanitizeString = (str) => {
  if (typeof str !== "string") return str;
  // Remove potential script tags and dangerous characters
  return str
    .replace(/<script[^>]*>.*?<\/script>/gi, "")
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, "")
    .replace(/javascript:/gi, "")
    .trim();
};

const validateLoginRequest = (req, res, next) => {
  try {
    const { email, password } = req.body;

    const errors = [];

    // Email validation
    if (!email) {
      errors.push("Email is required");
    } else if (typeof email !== "string") {
      errors.push("Email must be a string");
    } else if (!validateEmail(email)) {
      errors.push("Email format is invalid");
    } else if (email.length > 254) {
      errors.push("Email is too long (max 254 characters)");
    }

    // Password validation
    if (!password) {
      errors.push("Password is required");
    } else if (typeof password !== "string") {
      errors.push("Password must be a string");
    } else if (password.length < 6) {
      errors.push("Password must be at least 6 characters");
    } else if (password.length > 512) {
      errors.push("Password is too long (max 512 characters)");
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: "Validation failed",
        details: errors,
      });
    }

    // Sanitize inputs
    req.body.email = email.toLowerCase().trim();
    next();
  } catch (error) {
    res.status(400).json({
      error: "Request validation failed",
      message: error.message,
    });
  }
};

const validateRefreshRequest = (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: "Validation failed",
        details: ["refreshToken is required"],
      });
    }

    if (typeof refreshToken !== "string") {
      return res.status(400).json({
        error: "Validation failed",
        details: ["refreshToken must be a string"],
      });
    }

    if (refreshToken.length < 50) {
      return res.status(400).json({
        error: "Validation failed",
        details: ["Invalid refresh token format"],
      });
    }

    next();
  } catch (error) {
    res.status(400).json({
      error: "Request validation failed",
      message: error.message,
    });
  }
};

const validateTokenRequest = (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: "Validation failed",
        details: ["token is required"],
      });
    }

    if (typeof token !== "string") {
      return res.status(400).json({
        error: "Validation failed",
        details: ["token must be a string"],
      });
    }

    if (token.length < 50) {
      return res.status(400).json({
        error: "Validation failed",
        details: ["Invalid token format"],
      });
    }

    next();
  } catch (error) {
    res.status(400).json({
      error: "Request validation failed",
      message: error.message,
    });
  }
};

const validateEpisodeQuery = (req, res, next) => {
  try {
    const { page, limit, status, search } = req.query;

    // Validate pagination
    if (page && isNaN(parseInt(page))) {
      return res.status(400).json({
        error: "Validation failed",
        details: ["page must be a number"],
      });
    }

    if (limit && isNaN(parseInt(limit))) {
      return res.status(400).json({
        error: "Validation failed",
        details: ["limit must be a number"],
      });
    }

    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;

    if (pageNum < 1) {
      return res.status(400).json({
        error: "Validation failed",
        details: ["page must be >= 1"],
      });
    }

    if (limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        error: "Validation failed",
        details: ["limit must be between 1 and 100"],
      });
    }

    // Validate status enum
    const validStatuses = ["draft", "published", "approved", "pending"];
    if (status && !validStatuses.includes(status.toLowerCase())) {
      return res.status(400).json({
        error: "Validation failed",
        details: [`status must be one of: ${validStatuses.join(", ")}`],
      });
    }

    // Validate search string
    if (search && typeof search !== "string") {
      return res.status(400).json({
        error: "Validation failed",
        details: ["search must be a string"],
      });
    }

    if (search && search.length > 500) {
      return res.status(400).json({
        error: "Validation failed",
        details: ["search is too long (max 500 characters)"],
      });
    }

    // Sanitize search string
    if (search) {
      req.query.search = sanitizeString(search);
    }

    next();
  } catch (error) {
    res.status(400).json({
      error: "Query validation failed",
      message: error.message,
    });
  }
};

const validateUUIDParam = (paramName = "id") => {
  return (req, res, next) => {
    try {
      const id = req.params[paramName];

      if (!id) {
        return res.status(400).json({
          error: "Validation failed",
          details: [`${paramName} parameter is required`],
        });
      }

      // Accept both UUIDs and integer IDs for backward compatibility
      const isValidUUID = validateUUID(id);
      const isValidInteger = /^\d+$/.test(id);

      if (!isValidUUID && !isValidInteger) {
        return res.status(400).json({
          error: "Validation failed",
          details: [`${paramName} must be a valid UUID or integer ID`],
        });
      }

      next();
    } catch (error) {
      res.status(400).json({
        error: "Parameter validation failed",
        message: error.message,
      });
    }
  };
};

const validateAssetUpload = (req, res, next) => {
  try {
    const { assetType, metadata } = req.body;

    const errors = [];

    // Validate asset type - ALL TYPES (including all new wardrobe types)
    const validTypes = [
      // Lala
      "PROMO_LALA",
      "LALA_VIDEO",
      "LALA_HEADSHOT",
      "LALA_FULLBODY",

      // JustAWoman
      "PROMO_JUSTAWOMANINHERPRIME",
      "BRAND_LOGO",
      "BRAND_BANNER",
      "BRAND_SOCIAL",

      // Guest
      "PROMO_GUEST",
      "GUEST_VIDEO",
      "GUEST_HEADSHOT",

      // Background / Episodes / Promo
      "BACKGROUND_VIDEO",
      "BACKGROUND_IMAGE",
      "EPISODE_FRAME",
      "PROMO_VIDEO",
      "EPISODE_VIDEO",

      // Wardrobe
      "CLOTHING_DRESS",
      "CLOTHING_TOP",
      "CLOTHING_BOTTOM",
      "CLOTHING_SHOES",
      "CLOTHING_ACCESSORIES",
      "CLOTHING_JEWELRY",
      "CLOTHING_PERFUME",
    ];

    if (!assetType) {
      errors.push("assetType is required");
    } else if (!validTypes.includes(assetType)) {
      errors.push(`assetType must be one of: ${validTypes.join(", ")}`);
    }

    // Validate metadata if provided
    if (metadata) {
      if (typeof metadata === "string") {
        try {
          JSON.parse(metadata);
        } catch (e) {
          errors.push("Metadata must be valid JSON");
        }
      } else if (typeof metadata !== "object") {
        errors.push("Metadata must be a JSON object or string");
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: "Validation failed",
        details: errors,
      });
    }

    next();
  } catch (error) {
    res.status(400).json({
      error: "Upload validation failed",
      message: error.message,
    });
  }
};

module.exports = {
  validateEmail,
  validateUUID,
  sanitizeString,
  validateLoginRequest,
  validateRefreshRequest,
  validateTokenRequest,
  validateEpisodeQuery,
  validateUUIDParam,
  validateAssetUpload,
};
