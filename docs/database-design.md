# ServiceDesk Pro Database Design

This document details the complete MongoDB and Mongoose database architecture for **ServiceDesk Pro – IT Helpdesk & Asset Management**.

---

## 1. Collections

### 1.1 `organizations`
Represents the top-level tenant organization, supporting future multi-tenancy and global organizational configurations.

| Field Name | Data Type | Required? | Default Value | Description | Reference | Enum Values |
|---|---|---|---|---|---|---|
| `_id` | ObjectId | Yes | Auto-generated | Primary Key | None | None |
| `name` | String | Yes | None | Full legal or display name of the organization | None | None |
| `slug` | String | Yes | None | Unique URL-safe identifier (e.g., `acme-corp`) | None | None |
| `domain` | String | No | None | Corporate domain for auto-provisioning (e.g., `acme.com`) | None | None |
| `contactEmail` | String | Yes | None | Primary administrative and alerts email | None | None |
| `phone` | String | No | None | Organization contact phone number | None | None |
| `timezone` | String | No | `"UTC"` | Default timezone for business hours and SLA tracking | None | None |
| `businessHours` | Object | No | `{ start: "09:00", end: "18:00", workingDays: [1,2,3,4,5] }` | Operational schedule for SLA calculations | None | None |
| `defaultSlaPolicyId` | ObjectId | No | `null` | Default SLA policy fallback for tickets created within this organization | `slaPolicies` | None |
| `isActive` | Boolean | No | `true` | Status flag to enable or disable organization access | None | None |
| `createdAt` | Date | Yes | Current Date | Timestamp of record creation | None | None |
| `updatedAt` | Date | Yes | Current Date | Timestamp of last record update | None | None |

---

### 1.2 `departments`
Represents organizational functional units (e.g., IT, Human Resources, Finance, Operations) used for department-based ticket routing and access boundaries.

| Field Name | Data Type | Required? | Default Value | Description | Reference | Enum Values |
|---|---|---|---|---|---|---|
| `_id` | ObjectId | Yes | Auto-generated | Primary Key | None | None |
| `organizationId` | ObjectId | Yes | None | Organization to which the department belongs | `organizations` | None |
| `name` | String | Yes | None | Department name (e.g., `Information Technology`) | None | None |
| `code` | String | Yes | None | Short unique uppercase department code (e.g., `IT`, `HR`) | None | None |
| `description` | String | No | None | Operational responsibilities of the department | None | None |
| `managerId` | ObjectId | No | None | User who heads this department | `users` | None |
| `supportEmail` | String | No | None | Centralized inbound email address for the department | None | None |
| `isActive` | Boolean | No | `true` | Whether the department is currently active | None | None |
| `createdAt` | Date | Yes | Current Date | Timestamp of record creation | None | None |
| `updatedAt` | Date | Yes | Current Date | Timestamp of last record update | None | None |

---

### 1.3 `users`
Stores user credentials, profile information, organizational memberships, and role assignments.

| Field Name | Data Type | Required? | Default Value | Description | Reference | Enum Values |
|---|---|---|---|---|---|---|
| `_id` | ObjectId | Yes | Auto-generated | Primary Key | None | None |
| `organizationId` | ObjectId | Yes | None | Organization to which the user belongs | `organizations` | None |
| `departmentId` | ObjectId | Yes | None | Primary home department of the employee | `departments` | None |
| `firstName` | String | Yes | None | User's first name | None | None |
| `lastName` | String | Yes | None | User's last name | None | None |
| `email` | String | Yes | None | Unique login email address (case-insensitive) | None | None |
| `password` | String | Yes | None | Securely hashed password (bcrypt) | None | None |
| `phone` | String | No | None | Contact phone or internal extension | None | None |
| `jobTitle` | String | No | None | Professional job title | None | None |
| `role` | String | Yes | `"EMPLOYEE"` | User's primary system authorization role | None | `SYSTEM_ADMIN`, `IT_MANAGER`, `TECHNICIAN`, `EMPLOYEE`, `ASSET_MANAGER` |
| `assignedDepartments` | Array[ObjectId] | No | `[]` | Secondary departments a technician/manager is permitted to service | `departments` | None |
| `avatarUrl` | String | No | None | URL to user's profile picture | None | None |
| `isActive` | Boolean | No | `true` | Account active state | None | None |
| `lastLoginAt` | Date | No | None | Timestamp of the most recent successful login | None | None |
| `createdAt` | Date | Yes | Current Date | Timestamp of record creation | None | None |
| `updatedAt` | Date | Yes | Current Date | Timestamp of last record update | None | None |

---

### 1.4 `categories`
Hierarchical ticket and knowledge base classification taxonomy (supporting top-level categories and subcategories).

| Field Name | Data Type | Required? | Default Value | Description | Reference | Enum Values |
|---|---|---|---|---|---|---|
| `_id` | ObjectId | Yes | Auto-generated | Primary Key | None | None |
| `organizationId` | ObjectId | Yes | None | Parent organization | `organizations` | None |
| `departmentId` | ObjectId | Yes | None | Department that manages tickets in this category | `departments` | None |
| `name` | String | Yes | None | Category name (e.g., `Hardware`, `Software`, `Network`) | None | None |
| `parentId` | ObjectId | No | `null` | Parent category reference (`null` for top-level categories) | `categories` | None |
| `defaultPriority` | String | No | `"MEDIUM"` | Baseline priority assigned when this category is selected | None | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `defaultSlaPolicyId` | ObjectId | No | None | SLA policy mapped by default to this category | `slaPolicies` | None |
| `defaultAssigneeId` | ObjectId | No | None | Technician automatically assigned for this category | `users` | None |
| `isActive` | Boolean | No | `true` | Whether this category is available for ticket creation | None | None |
| `createdAt` | Date | Yes | Current Date | Timestamp of record creation | None | None |
| `updatedAt` | Date | Yes | Current Date | Timestamp of last record update | None | None |

---

### 1.5 `slaPolicies`
Defines Service Level Agreement targets, response/resolution deadlines, and threshold escalation triggers.

| Field Name | Data Type | Required? | Default Value | Description | Reference | Enum Values |
|---|---|---|---|---|---|---|
| `_id` | ObjectId | Yes | Auto-generated | Primary Key | None | None |
| `organizationId` | ObjectId | Yes | None | Tenant organization | `organizations` | None |
| `name` | String | Yes | None | Name of the SLA policy (e.g., `Standard SLA`, `VIP SLA`) | None | None |
| `description` | String | No | None | Description of the policy terms and coverage | None | None |
| `isDefault` | Boolean | No | `false` | Indicates if this is the default fallback policy | None | None |
| `businessHoursOnly` | Boolean | No | `true` | Whether timers pause outside configured business hours | None | None |
| `targets` | Array[Object] | Yes | `[]` | Array of response/resolution targets per priority | None | None |
| `targets.$.priority` | String | Yes | None | Priority tier for this target | None | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `targets.$.responseTimeMinutes` | Number | Yes | None | Maximum allowed minutes before first technician response | None | None |
| `targets.$.resolutionTimeMinutes` | Number | Yes | None | Maximum allowed minutes before ticket resolution | None | None |
| `escalationRules` | Array[Object] | No | `[]` | Rules executed when breach thresholds are reached | None | None |
| `escalationRules.$.priority` | String | Yes | None | Priority this rule applies to | None | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `escalationRules.$.triggerStage` | String | Yes | None | Milestone event triggering escalation | None | `APPROACHING_RESPONSE_BREACH`, `RESPONSE_BREACHED`, `APPROACHING_RESOLUTION_BREACH`, `RESOLUTION_BREACHED` |
| `escalationRules.$.thresholdPercentage` | Number | No | `80` | Percentage of SLA time elapsed before trigger (e.g., `80%`) | None | None |
| `escalationRules.$.notifyRoles` | Array[String] | No | `[]` | Role groups to notify | None | `SYSTEM_ADMIN`, `IT_MANAGER`, `TECHNICIAN` |
| `escalationRules.$.notifyUserIds` | Array[ObjectId] | No | `[]` | Specific users to alert | `users` | None |
| `escalationRules.$.action` | String | Yes | `"NOTIFY"` | Action to take | None | `NOTIFY`, `REASSIGN`, `ESCALATE_PRIORITY` |
| `escalationRules.$.reassignToUserId` | ObjectId | No | None | Target technician if action is `REASSIGN` | `users` | None |
| `isActive` | Boolean | No | `true` | Policy status | None | None |
| `createdAt` | Date | Yes | Current Date | Timestamp of record creation | None | None |
| `updatedAt` | Date | Yes | Current Date | Timestamp of last record update | None | None |

---

### 1.6 `tickets`
The core helpdesk transaction entity capturing ticket status, assignments, SLA timelines, and resolution details.

| Field Name | Data Type | Required? | Default Value | Description | Reference | Enum Values |
|---|---|---|---|---|---|---|
| `_id` | ObjectId | Yes | Auto-generated | Primary Key | None | None |
| `organizationId` | ObjectId | Yes | None | Tenant organization | `organizations` | None |
| `ticketNumber` | String | Yes | None | Human-readable sequential ID (e.g., `SDP-2026-0001`) | None | None |
| `title` | String | Yes | None | Short summary of the request or problem | None | None |
| `description` | String | Yes | None | Comprehensive explanation of the incident | None | None |
| `requesterId` | ObjectId | Yes | None | Employee who submitted the ticket | `users` | None |
| `departmentId` | ObjectId | Yes | None | Servicing department managing the ticket | `departments` | None |
| `categoryId` | ObjectId | Yes | None | Main issue category | `categories` | None |
| `subcategoryId` | ObjectId | No | None | Subcategory item (must belong to categoryId via parentId) | `categories` | None |
| `priority` | String | Yes | `"MEDIUM"` | Urgency and impact level | None | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `status` | String | Yes | `"OPEN"` | Current lifecycle state | None | `OPEN`, `ASSIGNED`, `IN_PROGRESS`, `PENDING`, `RESOLVED`, `CLOSED` |
| `assignedTo` | ObjectId | No | None | Technician currently assigned to work on the ticket | `users` | None |
| `assignedAt` | Date | No | None | Timestamp of technician assignment | None | None |
| `relatedAssetId` | ObjectId | No | None | Hardware or software asset involved in this ticket | `assets` | None |
| `channel` | String | No | `"PORTAL"` | Intake channel where ticket originated | None | `PORTAL`, `EMAIL`, `PHONE`, `CHAT` |
| `slaPolicyId` | ObjectId | No | None | SLA policy applied to calculate due dates | `slaPolicies` | None |
| `responseDue` | Date | No | None | Calculated deadline for initial technician response | None | None |
| `resolutionDue` | Date | No | None | Calculated deadline for issue resolution | None | None |
| `firstRespondedAt` | Date | No | None | Timestamp when technician first responded to requester | None | None |
| `resolvedAt` | Date | No | None | Timestamp when status changed to `RESOLVED` | None | None |
| `closedAt` | Date | No | None | Timestamp when ticket was marked `CLOSED` | None | None |
| `isResponseBreached` | Boolean | No | `false` | Flag indicating response time SLA was breached | None | None |
| `isResolutionBreached` | Boolean | No | `false` | Flag indicating resolution time SLA was breached | None | None |
| `slaPausedAt` | Date | No | `null` | Timestamp when ticket entered PENDING status and SLA timers were paused | None | None |
| `totalSlaPausedMinutes` | Number | No | `0` | Cumulative minutes ticket spent in PENDING status across all pauses | None | None |
| `escalationLevel` | Number | No | `0` | Standardized escalation tier: 0=NORMAL, 1=APPROACHING_BREACH, 2=BREACHED, 3=SEVERE_ESCALATION | None | `0`, `1`, `2`, `3` |
| `resolutionNotes` | String | No | None | Final explanation of how the issue was fixed | None | None |
| `rootCause` | String | No | None | Underlying technical root cause | None | None |
| `resolvedBy` | ObjectId | No | None | Technician who performed the resolution | `users` | None |
| `reopenedCount` | Number | No | `0` | Total number of times this ticket has been reopened | None | None |
| `lastReopenedAt` | Date | No | None | Timestamp of the most recent reopening | None | None |
| `lastReopenedBy` | ObjectId | No | None | User who reopened the ticket | `users` | None |
| `reopenReason` | String | No | None | Reason supplied by user for reopening the ticket | None | None |
| `tags` | Array[String] | No | `[]` | Categorical tags for search and reporting | None | None |
| `aiMetadata` | Object | No | `null` | Structured AI triage predictions and recommended solutions | None | None |
| `aiMetadata.predictedCategory` | ObjectId | No | None | AI-predicted issue category suggestion | `categories` | None |
| `aiMetadata.predictedPriority` | String | No | None | AI-predicted urgency rating suggestion | None | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `aiMetadata.probableIssue` | String | No | None | Diagnostic summary generated from ticket description | None | None |
| `aiMetadata.confidence` | Number | No | None | Model confidence score (range: 0.0 to 1.0) | None | None |
| `aiMetadata.suggestedKnowledgeArticles` | Array[ObjectId] | No | `[]` | Recommended solution articles for resolution | `knowledgeArticles` | None |
| `aiMetadata.model` | String | No | None | Identifier and version of the AI model used | None | None |
| `aiMetadata.processedAt` | Date | No | None | Timestamp when AI analysis was completed | None | None |
| `createdAt` | Date | Yes | Current Date | Timestamp of record creation | None | None |
| `updatedAt` | Date | Yes | Current Date | Timestamp of last record update | None | None |

> **Validation & Usage Rules for `tickets`:**
> 1. **Subcategory Integrity**: If `subcategoryId` is provided, it must belong to the same `organizationId` and its `parentId` must match `categoryId`.
> 2. **AI Predictions**: All `aiMetadata` fields are optional because tickets may be created before background AI classification executes. All AI outputs are advisory suggestions that authorized users (technicians, managers, requesters) can review and override at any time.

---

### 1.7 `ticketComments`
Stores public conversation replies between requester and technician, as well as private internal notes visible only to agents.

| Field Name | Data Type | Required? | Default Value | Description | Reference | Enum Values |
|---|---|---|---|---|---|---|
| `_id` | ObjectId | Yes | Auto-generated | Primary Key | None | None |
| `ticketId` | ObjectId | Yes | None | Associated ticket | `tickets` | None |
| `organizationId` | ObjectId | Yes | None | Tenant organization | `organizations` | None |
| `authorId` | ObjectId | Yes | None | User posting the comment or note | `users` | None |
| `content` | String | Yes | None | Text content of the comment or note | None | None |
| `isInternal` | Boolean | No | `false` | If `true`, hidden from employee (`INTERNAL_NOTE`) | None | None |
| `attachments` | Array[Object] | No | `[]` | Uploaded screenshots or logs | None | None |
| `attachments.$.fileName` | String | Yes | None | Original uploaded file name | None | None |
| `attachments.$.fileUrl` | String | Yes | None | Storage URL / path of the file | None | None |
| `attachments.$.fileSize` | Number | Yes | None | File size in bytes | None | None |
| `attachments.$.mimeType` | String | Yes | None | Content MIME type (e.g., `image/png`, `application/pdf`) | None | None |
| `attachments.$.uploadedAt` | Date | No | Current Date | Timestamp of upload | None | None |
| `createdAt` | Date | Yes | Current Date | Timestamp of record creation | None | None |
| `updatedAt` | Date | Yes | Current Date | Timestamp of last record update | None | None |

---

### 1.8 `workLogs`
Records technician effort, labor duration, and administrative time spent resolving tickets.

| Field Name | Data Type | Required? | Default Value | Description | Reference | Enum Values |
|---|---|---|---|---|---|---|
| `_id` | ObjectId | Yes | Auto-generated | Primary Key | None | None |
| `ticketId` | ObjectId | Yes | None | Associated ticket | `tickets` | None |
| `organizationId` | ObjectId | Yes | None | Tenant organization | `organizations` | None |
| `technicianId` | ObjectId | Yes | None | Technician who performed the labor | `users` | None |
| `timeSpentMinutes` | Number | Yes | None | Duration in minutes (minimum 1) | None | None |
| `workDate` | Date | Yes | Current Date | Date on which the work was performed | None | None |
| `description` | String | Yes | None | Technical breakdown of tasks executed | None | None |
| `createdAt` | Date | Yes | Current Date | Timestamp of record creation | None | None |
| `updatedAt` | Date | Yes | Current Date | Timestamp of last record update | None | None |

---

### 1.9 `vendors`
Stores equipment manufacturers, software publishers, suppliers, and third-party repair partners.

| Field Name | Data Type | Required? | Default Value | Description | Reference | Enum Values |
|---|---|---|---|---|---|---|
| `_id` | ObjectId | Yes | Auto-generated | Primary Key | None | None |
| `organizationId` | ObjectId | Yes | None | Tenant organization | `organizations` | None |
| `name` | String | Yes | None | Vendor company name (e.g., `Dell Technologies`) | None | None |
| `contactPerson` | String | No | None | Dedicated sales/account representative name | None | None |
| `email` | String | No | None | Contact or support email | None | None |
| `phone` | String | No | None | Contact phone number | None | None |
| `website` | String | No | None | Official website URL | None | None |
| `supportPortalUrl` | String | No | None | Link to vendor customer support portal | None | None |
| `supportPhone` | String | No | None | Dedicated technical warranty phone line | None | None |
| `accountNumber` | String | No | None | Corporate customer ID with this vendor | None | None |
| `contractNotes` | String | No | None | Service contract details and SLA agreements | None | None |
| `isActive` | Boolean | No | `true` | Vendor active status | None | None |
| `createdAt` | Date | Yes | Current Date | Timestamp of record creation | None | None |
| `updatedAt` | Date | Yes | Current Date | Timestamp of last record update | None | None |

---

### 1.10 `assets`
Maintains hardware, software licenses, and IT equipment inventory with specs, warranty, and current custody status.

| Field Name | Data Type | Required? | Default Value | Description | Reference | Enum Values |
|---|---|---|---|---|---|---|
| `_id` | ObjectId | Yes | Auto-generated | Primary Key | None | None |
| `organizationId` | ObjectId | Yes | None | Tenant organization | `organizations` | None |
| `assetTag` | String | Yes | None | Unique enterprise asset tag (barcode/QR code) | None | None |
| `serialNumber` | String | No | None | Hardware manufacturer serial number | None | None |
| `name` | String | Yes | None | Asset title (e.g., `MacBook Pro 16" M3`, `Dell Latitude 5540`) | None | None |
| `type` | String | Yes | None | Asset hardware/software category | None | `HARDWARE`, `SOFTWARE_LICENSE`, `PERIPHERAL`, `NETWORK_DEVICE`, `SERVER`, `OTHER` |
| `manufacturer` | String | Yes | None | Manufacturer name (e.g., `Apple`, `Dell`, `Cisco`) | None | None |
| `model` | String | No | None | Hardware model number or license edition | None | None |
| `vendorId` | ObjectId | No | None | Vendor/supplier from whom asset was purchased | `vendors` | None |
| `status` | String | Yes | `"PROCURED"` | Current operational lifecycle state | None | `PROCURED`, `IN_STOCK`, `ASSIGNED`, `IN_REPAIR`, `REPLACED`, `RETIRED` |
| `assignedTo` | ObjectId | No | None | Employee currently assigned custody | `users` | None |
| `assignedDepartmentId` | ObjectId | No | None | Department currently using the asset | `departments` | None |
| `assignedDate` | Date | No | None | Date of current assignment checkout | None | None |
| `purchaseOrderNumber` | String | No | None | Purchase order identifier | None | None |
| `purchaseDate` | Date | No | None | Date asset was acquired | None | None |
| `purchaseCost` | Number | No | None | Purchase acquisition cost | None | None |
| `currency` | String | No | `"USD"` | Currency for purchase cost | None | None |
| `warrantyStartDate` | Date | No | None | Warranty coverage start date | None | None |
| `warrantyEndDate` | Date | No | None | Warranty coverage expiration date | None | None |
| `warrantyType` | String | No | None | Coverage level (e.g., `3-Year Onsite ProSupport`) | None | None |
| `specifications` | Object | No | None | Technical attributes (CPU, RAM, Storage, MAC, License Key) | None | None |
| `location` | String | No | None | Physical location (e.g., `Room 204`, `Storage Closet B`) | None | None |
| `retirementDate` | Date | No | None | Date asset was decommissioned | None | None |
| `retirementReason` | String | No | None | Justification for decommissioning | None | `END_OF_LIFE`, `DAMAGED_BEYOND_REPAIR`, `OBSOLETE`, `DONATED`, `DISPOSED` |
| `disposalCertificate` | String | No | None | Certificate reference for certified e-waste destruction | None | None |
| `notes` | String | No | None | Internal technician notes | None | None |
| `createdAt` | Date | Yes | Current Date | Timestamp of record creation | None | None |
| `updatedAt` | Date | Yes | Current Date | Timestamp of last record update | None | None |

---

### 1.11 `assetAssignments`
An immutable historical audit trail of asset checkouts, transfers, and check-ins over the equipment's lifespan.

| Field Name | Data Type | Required? | Default Value | Description | Reference | Enum Values |
|---|---|---|---|---|---|---|
| `_id` | ObjectId | Yes | Auto-generated | Primary Key | None | None |
| `organizationId` | ObjectId | Yes | None | Tenant organization | `organizations` | None |
| `assetId` | ObjectId | Yes | None | Asset being assigned or returned | `assets` | None |
| `assignedTo` | ObjectId | Yes | None | User taking custody | `users` | None |
| `departmentId` | ObjectId | Yes | None | Department receiving custody | `departments` | None |
| `assignedBy` | ObjectId | Yes | None | Asset Manager or Admin authorizing the checkout | `users` | None |
| `assignedAt` | Date | Yes | Current Date | Checkout timestamp | None | None |
| `returnedAt` | Date | No | None | Check-in timestamp (`null` while actively assigned) | None | None |
| `receivedBy` | ObjectId | No | None | Staff member inspecting and receiving returned asset | `users` | None |
| `conditionOnAssignment` | String | No | `"GOOD"` | Physical state of equipment at checkout | None | None |
| `conditionOnReturn` | String | No | None | Physical state of equipment at check-in | None | None |
| `notes` | String | No | None | Assignment or return notes | None | None |
| `createdAt` | Date | Yes | Current Date | Timestamp of record creation | None | None |
| `updatedAt` | Date | Yes | Current Date | Timestamp of last record update | None | None |

---

### 1.12 `knowledgeArticles`
Self-service troubleshooting guides and internal IT runbooks.

| Field Name | Data Type | Required? | Default Value | Description | Reference | Enum Values |
|---|---|---|---|---|---|---|
| `_id` | ObjectId | Yes | Auto-generated | Primary Key | None | None |
| `organizationId` | ObjectId | Yes | None | Tenant organization | `organizations` | None |
| `title` | String | Yes | None | Article headline | None | None |
| `slug` | String | Yes | None | URL-safe slug | None | None |
| `content` | String | Yes | None | Article body (Markdown / HTML formatted) | None | None |
| `summary` | String | No | None | Short synopsis for search results | None | None |
| `categoryId` | ObjectId | Yes | None | Category grouping | `categories` | None |
| `tags` | Array[String] | No | `[]` | Keyword search tags | None | None |
| `authorId` | ObjectId | Yes | None | User who authored the article | `users` | None |
| `status` | String | Yes | `"DRAFT"` | Editorial publication status | None | `DRAFT`, `PUBLISHED`, `ARCHIVED` |
| `visibility` | String | Yes | `"PUBLIC"` | Access restriction (`INTERNAL_ONLY` = agents only) | None | `PUBLIC`, `INTERNAL_ONLY` |
| `viewCount` | Number | No | `0` | Number of times viewed | None | None |
| `helpfulVotes` | Number | No | `0` | Thumbs-up counter from users | None | None |
| `notHelpfulVotes` | Number | No | `0` | Thumbs-down counter from users | None | None |
| `lastReviewedAt` | Date | No | None | Date of last technical accuracy review | None | None |
| `reviewedBy` | ObjectId | No | None | User who conducted technical review | `users` | None |
| `createdAt` | Date | Yes | Current Date | Timestamp of record creation | None | None |
| `updatedAt` | Date | Yes | Current Date | Timestamp of last record update | None | None |

---

### 1.13 `notifications`
In-app user notifications for ticket assignments, replies, and SLA escalations.

| Field Name | Data Type | Required? | Default Value | Description | Reference | Enum Values |
|---|---|---|---|---|---|---|
| `_id` | ObjectId | Yes | Auto-generated | Primary Key | None | None |
| `organizationId` | ObjectId | Yes | None | Tenant organization | `organizations` | None |
| `recipientId` | ObjectId | Yes | None | User receiving the notification | `users` | None |
| `senderId` | ObjectId | No | None | User triggering the alert (`null` for system alerts) | `users` | None |
| `type` | String | Yes | None | Notification event type | None | `TICKET_CREATED`, `TICKET_ASSIGNED`, `TICKET_COMMENT`, `TICKET_STATUS_CHANGED`, `SLA_BREACH_WARNING`, `ASSET_ASSIGNED`, `SYSTEM_ALERT` |
| `title` | String | Yes | None | Brief notification headline | None | None |
| `message` | String | Yes | None | Notification description | None | None |
| `link` | String | No | None | In-app URL (e.g., `/tickets/SDP-2026-0001`) | None | None |
| `isRead` | Boolean | No | `false` | Whether notification has been viewed | None | None |
| `readAt` | Date | No | None | Timestamp when notification was read | None | None |
| `relatedTicketId` | ObjectId | No | None | Associated ticket | `tickets` | None |
| `relatedAssetId` | ObjectId | No | None | Associated asset | `assets` | None |
| `createdAt` | Date | Yes | Current Date | Timestamp of record creation | None | None |
| `updatedAt` | Date | Yes | Current Date | Timestamp of last record update | None | None |

---

### 1.14 `auditLogs`
Immutable compliance and security audit logs tracking critical user actions and system-generated events.

| Field Name | Data Type | Required? | Default Value | Description | Reference | Enum Values |
|---|---|---|---|---|---|---|
| `_id` | ObjectId | Yes | Auto-generated | Primary Key | None | None |
| `organizationId` | ObjectId | Yes | None | Tenant organization | `organizations` | None |
| `actorType` | String | Yes | `"HUMAN"` | Originator type of action (`HUMAN` vs `SYSTEM`) | None | `HUMAN`, `SYSTEM` |
| `actorId` | ObjectId | No | `null` | User who performed action (`null` for automated system events) | `users` | None |
| `actorRole` | String | No | `"SYSTEM"` | Snapshot of actor's role at time of action (`SYSTEM` for background jobs) | None | None |
| `action` | String | Yes | None | Action identifier (e.g., `TICKET_STATUS_CHANGED`, `SLA_AUTO_ESCALATED`) | None | None |
| `entityType` | String | Yes | None | Type of entity affected | None | `USER`, `TICKET`, `ASSET`, `SLA_POLICY`, `DEPARTMENT`, `CATEGORY`, `VENDOR`, `KB_ARTICLE` |
| `entityId` | ObjectId | Yes | None | ID of the entity modified | None | None |
| `ipAddress` | String | No | None | Client IP address of the request (`null` for system events) | None | None |
| `userAgent` | String | No | None | Browser / client user-agent (`null` for system events) | None | None |
| `details` | Object | No | None | Diff payload (`{ previousValues, newValues, description }`) | None | None |
| `timestamp` | Date | Yes | Current Date | Immutable event timestamp | None | None |

---

## 2. Relationships

The relationships in ServiceDesk Pro follow clean relational references via MongoDB `ObjectId` pointers:

### Core Hierarchy
1. **Organization → Departments (`1 : N`)**: An organization encompasses multiple departments (IT, HR, Sales). Every department belongs to one organization.
2. **Organization → Users (`1 : N`)**: All users belong to an organization.
3. **Organization → SLA Policies (`1 : N`)**: An organization defines one or more SLA policies. `organizations.defaultSlaPolicyId` points to the primary fallback policy (`N : 1`).
4. **Department → Users (`1 : N`)**: Every user has one primary home `departmentId`.
5. **Department → Categories (`1 : N`)**: Categories are scoped to specific departments (e.g., IT handles "VPN", HR handles "Payroll").
6. **Categories → Subcategories (`1 : N` Self-Referencing)**: A category points to an optional parent category via `parentId`. If `parentId === null`, it is a top-level category. If `subcategoryId` is set on a ticket, `subcategoryId.parentId` must match `categoryId`.
7. **Department → Tickets (`1 : N`)**: Tickets are assigned to a servicing department responsible for the work.

### Ticket Ecosystem
1. **User (Requester) → Tickets (`1 : N`)**: An employee can raise multiple tickets.
2. **User (Technician) → Tickets (`1 : N`)**: A technician can be assigned to multiple active tickets.
3. **Category & Subcategory → Tickets (`1 : N`)**: Every ticket is classified under one category and an optional subcategory.
4. **SLA Policy → Tickets (`1 : N`)**: A ticket references an SLA policy to compute target response and resolution deadlines.
5. **Asset → Tickets (`1 : N`)**: A ticket can optionally be linked to a physical or software asset (e.g., "Laptop keyboard broken").
6. **Ticket → Ticket Comments (`1 : N`)**: A ticket has multiple chronological comments and internal notes.
7. **Ticket → Work Logs (`1 : N`)**: Technicians log multiple time entries against a ticket.
8. **Knowledge Articles → Tickets (`N : N` via AI Metadata & Resolution)**: Articles can be suggested by AI (`aiMetadata.suggestedKnowledgeArticles`) or linked as official solutions upon resolution.

### Asset Ecosystem
1. **Vendor → Assets (`1 : N`)**: Vendors supply assets and hardware licenses.
2. **User (Custodian) → Assets (`1 : N`)**: An employee can currently be assigned custody of multiple assets (e.g., a laptop, monitor, and phone).
3. **Asset → Asset Assignments (`1 : N`)**: As an asset is checked out, transferred, or returned over years, each transaction creates an immutable record in `assetAssignments`.

---

## 3. Ticket Lifecycle

The ticket lifecycle guarantees predictable transitions and prevents premature closures:

```text
                  ┌──────────────┐
                  │     OPEN     │ (Ticket created by employee)
                  └──────┬───────┘
                         │
                         ▼ Assign technician
                  ┌──────────────┐
                  │   ASSIGNED   │ (Technician assigned)
                  └──────┬───────┘
                         │
                         ▼ Technician starts work
             ┌────► ┌──────────────┐ ◄────┐
             │      │ IN_PROGRESS  │      │
             │      └──────┬───────┘      │
User reply / │             │              │ Resumed by technician
info provided│             ▼ Waiting on   │ (SLA resolution clock resumes)
             │      ┌──────────────┐ info │
             └───── │   PENDING    │ ─────┘
                    └──────┬───────┘ (SLA resolution clock PAUSED)
                           │
                           ▼ Solution deployed
                    ┌──────────────┐
       ┌─────────── │   RESOLVED   │ ────────────┐
       │            └──────┬───────┘             │
Reopen │                   │ Application auto-   │ Reopened by
by User│                   │ close after 72 hrs  │ User / Admin
(<=72h)│                   ▼                     │
       │            ┌──────────────┐             │
       └──────────► │    CLOSED    │ ◄───────────┘
                    └──────────────┘
```

### Status Definitions:
* **`OPEN`**: Ticket has been submitted by the requester and is awaiting triage and assignment.
* **`ASSIGNED`**: A technician has been assigned ownership, but technical investigation has not yet commenced.
* **`IN_PROGRESS`**: The assigned technician is actively troubleshooting or implementing a fix.
* **`PENDING`**: Execution is paused because the technician is waiting for additional information from the requester, approval from a manager, or replacement parts from a vendor.
* **`RESOLVED`**: The technician has deployed the fix, recorded resolution notes, and provided instructions to the requester.
* **`CLOSED`**: The ticket is finalized.

### Allowed Status Transitions:
* `OPEN` → `ASSIGNED`, `CLOSED` (if canceled by requester)
* `ASSIGNED` → `IN_PROGRESS`, `PENDING`, `OPEN` (if unassigned)
* `IN_PROGRESS` → `PENDING`, `RESOLVED`
* `PENDING` → `IN_PROGRESS`, `RESOLVED`
* `RESOLVED` → `CLOSED`, `IN_PROGRESS` (if reopened)
* `CLOSED` → `IN_PROGRESS` (if reopened by admin or authorized exception)

### Reopening Rules:
1. **Eligibility Window**: A requester can reopen a ticket within **72 hours** of it being marked `RESOLVED`.
2. **Mandatory Reason**: Reopening requires submitting a written `reopenReason` explaining why the resolution was insufficient.
3. **Transition**: The ticket transitions from `RESOLVED` (or `CLOSED`) back to `IN_PROGRESS`.
4. **Counter & Audit**: Increments `reopenedCount`, updates `lastReopenedAt`, and creates an entry in `auditLogs`.

### SLA Pausing in `PENDING` Status:
* When a ticket transitions to `PENDING` (e.g., waiting for employee response or vendor parts), the SLA resolution clock is paused by recording `slaPausedAt = new Date()`.
* When the ticket exits `PENDING` (e.g., transitioning back to `IN_PROGRESS` or `RESOLVED`), the system calculates the duration elapsed since `slaPausedAt`:
  $$\Delta \text{minutes} = \frac{\text{Date.now}() - \text{slaPausedAt}}{60000}$$
* The system adds $\Delta \text{minutes}$ to `totalSlaPausedMinutes`, extends `resolutionDue` forward by $\Delta \text{minutes}$, and resets `slaPausedAt = null`.
* This ensures technicians are not penalized under SLA metrics while awaiting external user replies or third-party shipments.

### 72-Hour Auto-Close Mechanism:
* The automatic transition from `RESOLVED` to `CLOSED` after 72 hours is implemented through **application/service logic** (specifically, a scheduled background cron/worker job that periodically scans for tickets where `status === 'RESOLVED'` and `resolvedAt <= Date.now() - 72 hours` with no pending reopen requests).
* It is **not** an automatic MongoDB database trigger or schema-level constraint.

---

## 4. Roles & Data Access Scope

| Role | Description | Accessible Data Scope |
|---|---|---|
| **`SYSTEM_ADMIN`** | Complete system administration | Unrestricted read/write access across all organizations, departments, users, settings, SLA policies, and audit logs. |
| **`IT_MANAGER`** | Departmental service desk manager | Full access to tickets, technicians, categories, and SLA metrics within their primary department and any `assignedDepartments`. Read-only access to audit logs. |
| **`TECHNICIAN`** | IT support and service desk agent | Full access to tickets assigned to them or unassigned tickets within their `assignedDepartments`. Can post internal notes, log work time, view assets, and author knowledge articles. Cannot modify SLA policies. |
| **`EMPLOYEE`** | End user / Standard staff member | Restricted to creating and viewing **their own tickets** (`requesterId === user._id`). Can view public comments, public knowledge base articles, and assets currently assigned to them. Cannot view internal notes or work logs. |
| **`ASSET_MANAGER`** | Hardware & inventory specialist | Full read/write access to `assets`, `assetAssignments`, and `vendors`. Can view tickets linked to assets. Read-only access to users and departments. |

> **Role & Department Enforcement Architecture:**
> 1. `assignedDepartments` applies primarily to `TECHNICIAN` and `IT_MANAGER` to allow cross-departmental queue management (e.g., an IT technician who also resolves Facilities or AV equipment requests).
> 2. `EMPLOYEE` users remain strictly restricted to tickets where `requesterId === user._id`, regardless of department assignments.
> 3. Role and department authorization boundaries are enforced at the **application API/service layer** (Express JWT authentication middleware, RBAC checks, and route controllers) rather than relying solely on MongoDB database-level constraints.

---

## 5. Asset Lifecycle

```text
       ┌──────────────┐
       │   PROCURED   │ (PO created / asset ordered from vendor)
       └──────┬───────┘
              │ Received and tagged into stock
              ▼
       ┌──────────────┐ ◄────────────────┐
       │   IN_STOCK   │                  │ Returned to inventory
       └──────┬───────┘                  │
              │ Checkout to employee     │
              ▼                          │
       ┌──────────────┐                  │
       │   ASSIGNED   │ ─────────────────┤
       └──────┬───────┘                  │
              │ Hardware failure         │
              ▼                          │
       ┌──────────────┐                  │
       │  IN_REPAIR   │ ─────────────────┘
       └──────┬───────┘ (Repaired & returned)
              │
              ├──────────────────────────┐
              ▼ Unrepairable / replaced  ▼ End of life
       ┌──────────────┐           ┌──────────────┐
       │   REPLACED   │           │   RETIRED    │ (Decommissioned, e-waste)
       └──────────────┘           └──────────────┘
```

### Lifecycle Transitions:
1. **`PROCURED` → `IN_STOCK`**: Asset has arrived from the vendor, received an enterprise `assetTag`, and is placed in inventory.
2. **`IN_STOCK` → `ASSIGNED`**: Checked out to an employee. Creates an entry in `assetAssignments` and updates `assets.assignedTo`.
3. **`ASSIGNED` → `IN_STOCK`**: Employee returns equipment (e.g., offboarding). `assetAssignments.returnedAt` is finalized.
4. **`ASSIGNED` / `IN_STOCK` → `IN_REPAIR`**: Hardware requires maintenance or warranty service. Linked to vendor support.
5. **`IN_REPAIR` → `IN_STOCK`**: Repaired item is validated and placed back in stock.
6. **`IN_REPAIR` → `REPLACED`**: Hardware is defective and vendor provides a new replacement unit under warranty.
7. **`IN_STOCK` / `REPLACED` → `RETIRED`**: Equipment reaches end-of-life (EOL), is decommissioned, wiped of data, and transferred for disposal with a disposal certificate.

---

## 6. SLA Design & Calculation Engine

### Priority Tiers & Default Deadlines:
* **`CRITICAL`**: Response within **15 minutes** | Resolution within **2 hours** (24x7 coverage)
* **`HIGH`**: Response within **1 hour** | Resolution within **8 hours** (Business hours)
* **`MEDIUM`**: Response within **4 hours** | Resolution within **24 hours** (Business hours)
* **`LOW`**: Response within **8 hours** | Resolution within **48 hours** (Business hours)

### Connecting Tickets to SLA Policies:
1. When a ticket is created, the system resolves the applicable `slaPolicyId` using the following precedence:
   * **Rule 1**: Uses `categories.defaultSlaPolicyId` if defined on the selected category.
   * **Rule 2**: Falls back to `organizations.defaultSlaPolicyId` if set on the organization.
   * **Rule 3**: Falls back to the system policy marked `isDefault: true`.
2. The engine reads the policy's target metrics for the ticket's `priority`.
3. If `businessHoursOnly === true`, the system calculates `responseDue` and `resolutionDue` by advancing time only through the organization's working hours (e.g., Mon–Fri, 09:00–18:00), skipping nights, weekends, and configured company holidays.
4. The calculated `responseDue` and `resolutionDue` timestamps are persisted directly onto the `tickets` document.

### Standardized Escalation Levels:
The `tickets.escalationLevel` field is strictly standardized across the application as an integer enum:

| Tier Level | Constant Name | Trigger Condition & Description | Action Taken |
|---|---|---|---|
| **0** | `NORMAL` | Normal operating status. Ticket is well within SLA target thresholds. | Standard technician handling. |
| **1** | `APPROACHING_BREACH` | 80% of `responseDue` or `resolutionDue` has elapsed without completion. | Automated in-app & email notification to assigned technician and IT Manager. |
| **2** | `BREACHED` | 100% of deadline has expired without the required response or resolution. | `isResponseBreached` or `isResolutionBreached` set to `true`. Urgent alert to IT Manager and Admin. |
| **3** | `SEVERE_ESCALATION` | Breached ticket remains unaddressed beyond secondary threshold (e.g., 150% of SLA time). | Auto-reassignment to lead technician or auto-elevation of priority (e.g., HIGH → CRITICAL). |

---

## 7. Indexing Strategy

| Collection | Indexed Fields | Index Type | Query / Operation Optimized |
|---|---|---|---|
| `tickets` | `{ organizationId: 1, status: 1, priority: 1 }` | Compound | Helpdesk dashboard Kanban boards and queue filtering |
| `tickets` | `{ organizationId: 1, assignedTo: 1, status: 1 }` | Compound | Technician "My Active Assigned Tickets" view |
| `tickets` | `{ organizationId: 1, departmentId: 1, status: 1 }` | Compound | Department manager queue triage |
| `tickets` | `{ organizationId: 1, requesterId: 1, createdAt: -1 }` | Compound | Employee self-service portal "My Requests" list |
| `tickets` | `{ organizationId: 1, ticketNumber: 1 }` | Unique | Direct ticket lookup by code (e.g., `SDP-2026-0001`) |
| `tickets` | `{ "resolutionDue": 1, "status": 1 }` | Compound | SLA monitoring daemon checking for approaching or overdue tickets |
| `assets` | `{ organizationId: 1, assetTag: 1 }` | Unique | Instant barcode and QR code scanner lookups |
| `assets` | `{ organizationId: 1, serialNumber: 1 }` | Sparse Unique | Manufacturer serial number tracking |
| `assets` | `{ "assignedTo": 1, "status": 1 }` | Compound | Finding all equipment currently assigned to an employee |
| `assets` | `{ organizationId: 1, status: 1, type: 1 }` | Compound | Asset Manager inventory stockroom counts |
| `ticketComments` | `{ ticketId: 1, createdAt: 1 }` | Compound | Chronological rendering of ticket conversation thread |
| `workLogs` | `{ ticketId: 1, createdAt: -1 }` | Compound | Ticket work breakdown and technician time audit |
| `knowledgeArticles`| `{ title: "text", content: "text", tags: "text" }` | Text Index | High-speed keyword search and AI solution matching |
| `notifications` | `{ recipientId: 1, isRead: 1, createdAt: -1 }` | Compound | Top navigation bar unread notification badge counter |
| `auditLogs` | `{ organizationId: 1, entityType: 1, entityId: 1, timestamp: -1 }` | Compound | Viewing complete history for a specific ticket, asset, or user |

---

## 8. Audit Logging

Every critical system event creates an immutable document in the `auditLogs` collection containing the actor information, action type, entity references, IP address, and a JSON `details` diff object (`previousValues` vs `newValues`).

### Support for System-Generated Events:
Many operational actions (such as automated SLA breach escalation, 72-hour auto-closure of resolved tickets, and periodic email ingest) are initiated by background workers rather than human users. To record these reliably without violating foreign key integrity:
* `actorId` is **optional** (set to `null` for background workers).
* `actorType` is explicitly provided as either `"HUMAN"` or `"SYSTEM"`.
* `actorRole` is recorded as `"SYSTEM"` for automated jobs.

### Actions Recorded:
1. **Authentication**: `USER_LOGIN`, `USER_LOGOUT`, `PASSWORD_RESET_REQUESTED`, `PASSWORD_CHANGED`.
2. **Ticket Operations**:
   * `TICKET_CREATED`: Captures initial priority, category, and requester.
   * `TICKET_ASSIGNED`: Captures previous technician vs newly assigned technician.
   * `TICKET_STATUS_CHANGED`: Captures status transition (e.g., `IN_PROGRESS` → `RESOLVED`).
   * `TICKET_PRIORITY_CHANGED`: Captures priority modification and reason.
   * `TICKET_REOPENED`: Captures reopening user and justification.
   * `TICKET_AUTO_CLOSED`: System-generated closure 72 hours post-resolution.
   * `SLA_AUTO_ESCALATED`: System-generated escalation upon deadline breach.
3. **Asset Operations**:
   * `ASSET_CREATED`: New hardware added to inventory.
   * `ASSET_ASSIGNED`: Checkout event linking asset to employee.
   * `ASSET_RETURNED`: Check-in event recording return condition.
   * `ASSET_STATUS_CHANGED`: Transfer to repair or replacement.
   * `ASSET_RETIRED`: Decommissioning with disposal certificate.
4. **Administrative & Configuration Actions**:
   * `USER_CREATED`, `USER_ROLE_CHANGED`, `USER_DEACTIVATED`.
   * `DEPARTMENT_CREATED`, `DEPARTMENT_UPDATED`.
   * `SLA_POLICY_CREATED`, `SLA_POLICY_MODIFIED`.
   * `CATEGORY_CREATED`, `CATEGORY_REMOVED`.

---

## 9. Entity Relationship Diagram

```text
+-----------------------+          +-----------------------+
|     organizations     | 1      N |      departments      |
|-----------------------|----------|-----------------------|
| _id (PK)              |          | _id (PK)              |
| name                  |          | organizationId (FK)   |
| slug (UK)             |          | name                  |
| timezone              |          | code (UK)             |
| businessHours         |          | managerId (FK)        |
| defaultSlaPolicyId(FK)|          +-----------------------+
+-----------------------+                     | 1
           | 1                                | N
           |                                  |
           | N                                |
+-----------------------+          +-----------------------+
|         users         |          |      categories       |
|-----------------------|          |-----------------------|
| _id (PK)              |          | _id (PK)              |
| organizationId (FK)   |          | departmentId (FK)     |
| departmentId (FK)     |          | parentId (Self FK)    |
| role (ENUM)           |          | name                  |
| assignedDepartments[] |          +-----------------------+
+-----------------------+                     | 1
     | 1              | 1                     |
     |                |                       | N
     | N (Requester)  | N (Custodian)         |
+-----------------------+          +-----------------------+
|        tickets        |          |        assets         |
|-----------------------|          |-----------------------|
| _id (PK)              |          | _id (PK)              |
| ticketNumber (UK)     |          | assetTag (UK)         |
| requesterId (FK)      |          | category / type (ENUM)|
| assignedTo (FK)       |          | status (ENUM)         |
| departmentId (FK)     |          | vendorId (FK)         |
| categoryId (FK)       |          | assignedTo (FK)       |
| subcategoryId (FK)    |          +-----------------------+
| status (ENUM)         |                     | 1
| priority (ENUM)       |                     | N
| slaPolicyId (FK)      |                     |
| relatedAssetId (FK) --+---------------------+
| slaPausedAt           |          +-----------------------+
| totalSlaPausedMinutes |          |   assetAssignments    |
| escalationLevel (0-3) |          |-----------------------|
| aiMetadata (Subdoc)   |          | _id (PK)              |
+-----------------------+          | assetId (FK)          |
     | 1              | 1          | assignedTo (FK)       |
     |                |            | assignedBy (FK)       |
     | N              | N          | assignedAt            |
+------------------+  |            +-----------------------+
|  ticketComments  |  |
|------------------|  |            +-----------------------+
| _id (PK)         |  |            |       workLogs        |
| ticketId (FK)    |  +----------> |-----------------------|
| authorId (FK)    |             N | _id (PK)              |
| isInternal       |               | ticketId (FK)         |
| content          |               | technicianId (FK)     |
| attachments[]    |               | timeSpentMinutes      |
+------------------+               +-----------------------+
```

---

## 10. Design Decisions & Scalability Rationale

### 1. Dedicated Collections for Comments and Work Logs vs Embedding
* **Decision**: `ticketComments` and `workLogs` are separate referenced collections rather than arrays inside `tickets`.
* **Reasoning**:
  * In active enterprise service desks, complex tickets accumulate dozens or hundreds of replies, logs, and screenshots.
  * MongoDB documents have a hard **16MB limit**. Unbounded arrays in frequently updated documents cause document growth, requiring the WiredTiger storage engine to relocate documents on disk, degrading write performance.
  * Storing comments separately allows loading ticket list views (Kanban/table) at high speed without pulling megabytes of conversation data over the network.

### 2. Denormalized Current Asset Custody + Normalized History
* **Decision**: Current custody is stored directly on `assets.assignedTo` and `assets.assignedDepartmentId`, while checkout history is preserved in `assetAssignments`.
* **Reasoning**:
  * 95% of queries ask "Who has this laptop?" or "What assets are assigned to User X?" Storing this on the asset document resolves the query in a single index lookup without costly aggregation joins (`$lookup`).
  * `assetAssignments` remains an append-only audit trail guaranteeing historical custody integrity.

### 3. Precomputed SLA Due Dates with Pause Tracking
* **Decision**: The system precomputes `responseDue` and `resolutionDue` timestamps on ticket creation and adjusts them via `slaPausedAt` and `totalSlaPausedMinutes` when `PENDING`.
* **Reasoning**:
  * Dynamically calculating business hours across thousands of open tickets during every dashboard render is CPU intensive.
  * Storing precalculated timestamps enables a lightweight background worker to query overdue tickets in $O(\log N)$ time using the index `{ "resolutionDue": 1, "status": 1 }`.
  * Pausing tracking ensures fairness while technicians wait for user input or vendor parts.

### 4. Self-Referencing Category Hierarchy
* **Decision**: A single `categories` collection with `parentId` represents both categories and subcategories.
* **Reasoning**:
  * Avoids managing separate collections for categories and subcategories.
  * Enables arbitrary nesting depth if needed, while keeping the data layer simple and clean.

### 5. Multi-Tenancy Architecture
* **Decision**: Every collection includes an indexed `organizationId`.
* **Reasoning**:
  * Provides seamless tenant isolation.
  * Allows ServiceDesk Pro to support multi-subsidiary enterprise setups or SaaS deployments with zero schema refactoring.

### 6. Dual Actor Model for Audit Logging (`HUMAN` vs `SYSTEM`)
* **Decision**: `auditLogs.actorId` is nullable, and `actorType` explicitly distinguishes between human users and background workers.
* **Reasoning**:
  * Critical lifecycle events (SLA escalations, auto-closures, scheduled reports) are triggered by background jobs where no human session exists. Making `actorId` optional avoids creating dummy "system" user accounts or breaking relational integrity.
