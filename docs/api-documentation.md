# ServiceDesk Pro — REST API Documentation

This document describes all REST API endpoints available in ServiceDesk Pro, including authentication requirements, request parameters, JSON bodies, role permissions, and response formats.

---

## 1. Global Conventions

### Base URL
- Local Development: `http://localhost:5000/api`
- Production: `https://api.yourdomain.com/api`

### Authentication
All private endpoints require a Bearer token in the HTTP `Authorization` header:
```http
Authorization: Bearer <jwt_token>
```

### Standard Success Response Format
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}
```

### Standard Error Response Format
```json
{
  "success": false,
  "message": "Descriptive error message"
}
```

### Common HTTP Status Codes
- `200 OK`: Request succeeded.
- `201 Created`: Resource successfully created.
- `400 Bad Request`: Validation failure or invalid request body.
- `401 Unauthorized`: Missing, invalid, or expired JWT token, or account inactive.
- `403 Forbidden`: Insufficient role or cross-department/organization permission.
- `404 Not Found`: Resource does not exist or belongs to another organization tenant.
- `500 Internal Server Error`: Unexpected server exception.

---

## 2. Health Check

### `GET /api/health`
Verifies API server liveness.
- **Access**: Public
- **Response** (`200 OK`):
  ```json
  {
    "status": "success",
    "message": "ServiceDesk Pro API is running",
    "timestamp": "2026-09-26T13:48:49.947Z"
  }
  ```

---

## 3. Authentication & Profile

### `POST /api/auth/login`
Authenticates a user and issues a JWT token.
- **Access**: Public
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "Password123!"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "_id": "6ab7ceae9b697dc27b0421c2",
      "firstName": "System",
      "lastName": "Administrator",
      "email": "admin@servicedesk.local",
      "role": "SYSTEM_ADMIN",
      "organizationId": "6ab7ceae9b697dc27b0421c0",
      "departmentId": "6ab7ceae9b697dc27b0421c1",
      "isActive": true,
      "lastLoginAt": "2026-09-26T14:00:00.000Z"
    }
  }
  ```

### `GET /api/auth/me`
Retrieves the safe authenticated user profile from the database.
- **Access**: Private (Any valid authenticated user)
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "user": {
      "_id": "6ab7ceae9b697dc27b0421c2",
      "firstName": "System",
      "lastName": "Administrator",
      "email": "admin@servicedesk.local",
      "role": "SYSTEM_ADMIN"
    }
  }
  ```

---

## 4. Ticket Management

### `POST /api/tickets`
Creates a new support ticket and applies SLA calculations.
- **Access**: Private (All roles). Employees are forced as `requesterId`.
- **Request Body**:
  ```json
  {
    "title": "VPN connection failure on gateway 2",
    "description": "Getting timeout error code 403 when connecting from home office.",
    "departmentId": "6ab7ceae9b697dc27b0421c1",
    "categoryId": "6ab7ceae9b697dc27b0421c3",
    "priority": "HIGH",
    "channel": "PORTAL"
  }
  ```
- **Response** (`201 Created`): Returns ticket object with generated `ticketNumber` (`SDP-YYYY-XXXX`) and computed SLA deadlines (`responseDueDate`, `resolutionDueDate`).

### `GET /api/tickets`
Lists tickets with pagination, keyword search, and filters.
- **Access**: Private. Automatically scoped:
  - `EMPLOYEE`: Returns tickets where `requesterId` equals user ID.
  - `TECHNICIAN`: Scoped to tickets in assigned departments.
  - `SYSTEM_ADMIN` / `IT_MANAGER`: All tickets in organization.
- **Query Parameters**:
  - `page` (default: 1)
  - `limit` (default: 15)
  - `search` (searches title, description, ticketNumber)
  - `status` (`OPEN`, `ASSIGNED`, `IN_PROGRESS`, `PENDING`, `RESOLVED`, `CLOSED`)
  - `priority` (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)
  - `departmentId`
  - `categoryId`
  - `assignedTo`
  - `sort` (default: `-createdAt`)

### `GET /api/tickets/:id`
Retrieves single ticket details with populated references.

### `PATCH /api/tickets/:id`
Updates ticket fields.
- **Access**: Permitted if user has edit rights and ticket is not resolved/closed.

### `PATCH /api/tickets/:id/assign`
Assigns or reassigns ticket to a technician.
- **Access**: `TECHNICIAN`, `IT_MANAGER`, `SYSTEM_ADMIN`
- **Request Body**: `{ "assignedTo": "<userId>" }`

### `PATCH /api/tickets/:id/status`
Transitions ticket lifecycle status.
- **Access**: Private (Role-governed)
- **Request Body**:
  ```json
  {
    "status": "RESOLVED",
    "resolutionNotes": "Reset VPN profile on RADIUS server and confirmed connectivity.",
    "rootCause": "Stale credentials cache"
  }
  ```
- **Rules**:
  - Transitioning to `RESOLVED` requires `resolutionNotes`.
  - Transitioning to `PENDING` pauses the active SLA timer.
  - Reopening a `RESOLVED` ticket requires `reopenReason` and is permitted for employees only within 72 hours of resolution.

### `PATCH /api/tickets/:id/asset`
Links a hardware/software asset to a ticket.
- **Request Body**: `{ "assetId": "<assetId>" }`

---

## 5. Comments, Attachments & Work Logs

### `POST /api/tickets/:id/comments`
Posts a public reply or internal technician note with optional attachments (multipart/form-data).
- **Access**: Private (Employees can only post public comments `isInternal: false`).
- **Form Fields**:
  - `body`: Text content (required)
  - `isInternal`: Boolean (`true` for technician-only notes, restricted from employees)
  - `attachments`: Up to 5 files (max 10MB each, safe MIME types)

### `GET /api/tickets/:id/comments`
Retrieves comment thread. Internal notes are stripped for `EMPLOYEE` users.

### `GET /api/tickets/:id/activity`
Retrieves combined chronological audit timeline (status changes, assignments, comments). Sensitive audit details are redacted for employees.

### `GET /api/tickets/:id/attachments/:filename`
Downloads an attachment securely. Enforces organization tenant boundary and blocks employees from downloading internal-note attachments.

### `POST /api/tickets/:id/work-logs`
Logs technician hours on a ticket.
- **Access**: `TECHNICIAN`, `IT_MANAGER`, `SYSTEM_ADMIN` (Blocked for `EMPLOYEE`)
- **Request Body**:
  ```json
  {
    "timeSpentMinutes": 45,
    "description": "Investigated router routing table and refreshed IP lease",
    "isBillable": false
  }
  ```

---

## 6. Asset & Vendor Inventory

### `GET /api/assets`
Lists assets with filters (`status`, `assetType`, `search`, `page`, `limit`).
- Employees only see assets currently assigned to them (`currentAssigneeId`).

### `POST /api/assets`
Registers a new asset in inventory.
- **Access**: `SYSTEM_ADMIN`, `IT_MANAGER`, `ASSET_MANAGER`
- **Request Body**:
  ```json
  {
    "assetTag": "AST-2026-0042",
    "name": "Dell Latitude 5540",
    "assetType": "LAPTOP",
    "category": "Workstation",
    "serialNumber": "SN-8837192",
    "manufacturer": "Dell",
    "model": "Latitude 5540",
    "purchaseCost": 1299.00
  }
  ```

### `POST /api/assets/:id/assign`
Checks out an asset to an employee or department custodian.
- **Access**: `SYSTEM_ADMIN`, `IT_MANAGER`, `ASSET_MANAGER`
- **Request Body**:
  ```json
  {
    "userId": "<userId>",
    "condition": "NEW",
    "notes": "Issued for remote engineering position"
  }
  ```

### `POST /api/assets/:id/return`
Returns an asset to stock.
- **Request Body**:
  ```json
  {
    "condition": "GOOD",
    "notes": "Returned during hardware refresh"
  }
  ```

### `GET /api/assets/:id/assignments`
Retrieves complete custody and return history.

### `GET /api/vendors` & `POST /api/vendors`
Vendor directory CRUD for equipment and software suppliers.

---

## 7. Knowledge Base

### `GET /api/knowledge-base`
Searches articles by query, category, and tags.
- Employees receive `PUBLISHED` and `PUBLIC` articles only.
- Technicians and managers can access `INTERNAL` articles and draft workflows.

### `POST /api/knowledge-base`
Creates a knowledge article. Generates unique URL-safe slug.
- **Access**: `TECHNICIAN`, `IT_MANAGER`, `SYSTEM_ADMIN`

### `PATCH /api/knowledge-base/:id/publish`
Publishes an article, making it available to authorized users.

### `POST /api/knowledge-base/:id/feedback`
Submits helpfulness voting.
- **Request Body**: `{ "isHelpful": true }`

---

## 8. Notifications

### `GET /api/notifications`
Retrieves authenticated user notifications (unread first).

### `PATCH /api/notifications/:id/read`
Marks single notification as read.

### `PATCH /api/notifications/read-all`
Marks all user notifications as read.
