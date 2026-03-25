---
description: "List all API routes with their HTTP methods, auth requirements, and handlers. Use for: route inventory, API documentation, auth audit, endpoint list."
---
Audit all Express routes in this codebase and produce a comprehensive inventory.

## Output Format
Create a markdown table with these columns:
| Method | Path | Auth | Handler | Description |

Where:
- **Method**: GET, POST, PUT, DELETE, etc.
- **Path**: Full route path (e.g., `/api/v1/memories/writemode`)
- **Auth**: `optionalAuth`, `requireAuth`, or `none`
- **Handler**: Function name or inline description
- **Description**: Brief purpose (infer from code if no comment)

## Scan Locations
1. `src/routes/*.js` — all route files
2. `app.js` — route mounting points
3. Look for `router.get()`, `router.post()`, etc. patterns

## Group By
Organize routes by their base path:
- `/api/v1/memories/*` — AI/Story endpoints
- `/api/v1/registry/*` — Character registry
- `/api/v1/auth/*` — Authentication
- Other mounted routes

## Flags to Note
- Mark SSE streaming endpoints with 🔄
- Mark endpoints with AI calls with 🤖
- Mark deprecated routes with ⚠️
