# ServiceDesk Pro — IT Helpdesk & Asset Management Platform

ServiceDesk Pro is an enterprise-grade, multi-tenant IT Helpdesk & Asset Management platform built with the MERN stack (MongoDB, Express, React 19, and Node.js). Designed to streamline enterprise IT support operations, the platform integrates automated ticket lifecycle workflows, multi-tiered SLA calculation and escalation policies, hardware/software asset custody tracking, self-service knowledge base repositories, AI-assisted ticket triage, operational analytics dashboards, and role-based data isolation.

---

## Table of Contents
- [Architecture & Tech Stack](#architecture--tech-stack)
- [Key Features](#key-features)
- [Role-Based Access Control (RBAC)](#role-based-access-control-rbac)
- [Prerequisites](#prerequisites)
- [Local Installation & Setup](#local-installation--setup)
- [Environment Variables (Placeholders Only)](#environment-variables-placeholders-only)
- [Database Setup & Admin Bootstrap](#database-setup--admin-bootstrap)
- [Running Tests & Quality Checks](#running-tests--quality-checks)
- [Production Deployment Guide](#production-deployment-guide)
- [Known Limitations & Future Roadmap](#known-limitations--future-roadmap)
- [Documentation Index](#documentation-index)

---

## Architecture & Tech Stack

```
   ┌────────────────────────────────────────────────────────┐
   │                  React 19 Client SPA                   │
   │      Vite • React Router v7 • Lucide • Vanilla CSS     │
   └───────────────────────────┬────────────────────────────┘
                               │ HTTP / REST / JSON
                               ▼
   ┌────────────────────────────────────────────────────────┐
   │                  Express.js API Server                 │
   │    CORS • Multer Storage • JWT Auth • Centralized Error│
   └─────────────┬────────────────────────────┬─────────────┘
                 │                            │
                 ▼                            ▼
   ┌───────────────────────────┐  ┌─────────────────────────┐
   │      MongoDB Database     │  │   Background Workers    │
   │  Mongoose ODM • Multi-Org │  │ SLA Escalation Engine   │
   │  Tenant Isolation Schema  │  │ 72-Hour Auto-Close Job  │
   └───────────────────────────┘  └─────────────────────────┘
```

- **Backend**: Node.js, Express.js (v5), Mongoose ODM (v9), JSON Web Tokens (jsonwebtoken), bcryptjs, Multer file storage.
- **Frontend**: React 19, Vite (v8), React Router (v7), Lucide React iconography, custom CSS design system.
- **Database**: MongoDB (Local or MongoDB Atlas) with organization-level multitenant isolation.
- **Automation**: In-process background timer monitoring SLA breach thresholds (80% warning, 100% breach, 150% severe escalation) and 72-hour auto-resolution ticket closure.

---

## Key Features

1. **Enterprise Ticket Management**:
   - Sequential ticket numbering (`SDP-YYYY-XXXX`).
   - Defined lifecycle transitions: `OPEN` → `ASSIGNED` → `IN_PROGRESS` → `PENDING` (pauses SLA) → `RESOLVED` (requires resolution notes) → `CLOSED`.
   - Reopening rules: Employees can reopen resolved tickets within a 72-hour window with required justification.
   - Dual-mode conversation threads: Public technician-requester replies and role-restricted internal notes.
   - Secure file attachments with MIME validation, 10 MB caps, and directory-traversal protection.
   - Technician work logging (time spent tracking with validation).

2. **Automated SLA Policies & Escalations**:
   - Tiered response and resolution deadlines configured by priority (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`).
   - Operational business hours schedule calculations (e.g. Monday–Friday 09:00–18:00) and 24x7 calendar options.
   - Active SLA pause clock during `PENDING` status (waiting on customer).
   - Multi-stage background escalation triggers at 80% (Warning), 100% (Breach), and 150% (Severe).

3. **IT Asset & Vendor Inventory**:
   - Hardware and software tracking (`LAPTOP`, `DESKTOP`, `SERVER`, `MOBILE`, `SOFTWARE`, `NETWORK`, `PERIPHERAL`).
   - Complete custody lifecycle: Check out (`ASSIGNED`), return (`IN_STOCK`), maintenance (`IN_REPAIR`), and retirement.
   - Audited assignment history logs recording custodians, condition notes, and assignment dates.
   - Direct ticket-to-asset linking for hardware defect diagnosis.
   - Vendor directory managing contract terms and support contacts.

4. **Self-Service Knowledge Base**:
   - Rich technical articles with search, category filtering, and slug routing.
   - Publication review workflow: `DRAFT` → `UNDER_REVIEW` → `PUBLISHED` → `ARCHIVED`.
   - Visibility scopes: Public guides for employees vs. Internal procedures for IT technicians.
   - User feedback voting (Helpful / Not Helpful counters).

5. **AI-Assisted Triage & Intelligence**:
   - Real-time diagnostic evaluation of ticket title and description for urgency and outage keywords.
   - Predictive categorization matching organizational service catalog definitions.
   - Advisory suggestion banner with confidence rating and non-destructive "Apply" user overrides.
   - Instant Knowledge Base article recommendations surfaced during ticket creation.

6. **Operational Analytics & Exports**:
   - Live metrics: Total volume, queue backlogs, SLA compliance rate (%), net average resolution hours, and asset fleet expenditure.
   - Visual status distributions, priority breakdowns, and technician workload capacity.
   - Date range filtering (`7d`, `30d`, `90d`, `All Time`).
   - Sanitized CSV export generation for tickets and assets with field-level quoting and XSS prevention.
   - Browser print and PDF summary layout.

---

## Role-Based Access Control (RBAC)

The application enforces five distinct user roles with strict organization boundaries:

| Role | Scope & Permissions |
|---|---|
| `SYSTEM_ADMIN` | Global administrative control across the organization. Full CRUD over users, departments, categories, SLA policies, assets, knowledge articles, and analytics. |
| `IT_MANAGER` | Organizational operational oversight. Manages team ticket queues, reassignments, vendor contracts, assets, knowledge publications, and analytics reports. |
| `TECHNICIAN` | Operational frontline staff. Accesses tickets within authorized departments, logs work time, writes internal notes, creates assets/vendors, and drafts KB articles. |
| `ASSET_MANAGER` | Dedicated hardware/software fleet controller. Manages asset lifecycles, vendor contracts, custody assignments, equipment health, and inventory reports. |
| `EMPLOYEE` | End-user self-service. Submits support requests, views own tickets and assigned equipment, browses public knowledge articles, and reopens resolved issues within 72 hours. Cannot view internal notes, work logs, or other users' records. |

---

## Prerequisites

- **Node.js**: `v18.0.0` or higher (Node `v20+` recommended)
- **npm**: `v9.0.0` or higher
- **MongoDB**: Local MongoDB instance (`v5.0+`) or MongoDB Atlas cluster URI
- **Web Browser**: Modern Chromium, Firefox, or Safari browser

---

## Local Installation & Setup

### 1. Clone or Open Workspace
Ensure the project files are located in your workspace directory:
```bash
cd "ServiceDesk pro"
```

### 2. Install Server Dependencies
```bash
cd server
npm install
```

### 3. Install Client Dependencies
```bash
cd ../client
npm install
```

---

## Environment Variables (Placeholders Only)

### Backend Configuration (`server/.env`)
Create a file named `.env` inside the `server/` directory:
```env
# Server Port
PORT=5000

# Environment Mode
NODE_ENV=development

# MongoDB Connection URI (Local MongoDB or MongoDB Atlas)
# Example Local: mongodb://localhost:27017/servicedesk_pro
# Example Atlas: mongodb+srv://<db_username>:<db_password>@cluster0.mongodb.net/servicedesk_pro?retryWrites=true&w=majority
MONGODB_URI=mongodb://localhost:27017/servicedesk_pro

# Allowed CORS Origins (comma-separated list for production)
CORS_ORIGIN=http://localhost:5173

# JWT Authentication (32+ character random secret)
JWT_SECRET=your_jwt_secret_key_here_min_32_characters
JWT_EXPIRES_IN=7d

# File Storage Provider
STORAGE_PROVIDER=local
```

### Frontend Configuration (`client/.env`)
Create a file named `.env` inside the `client/` directory:
```env
# Client API Base URL
# In local development, the Vite proxy directs /api to http://localhost:5000
VITE_API_BASE_URL=/api
```

> **Security Rule**: Never commit actual `.env` files with production passwords or connection strings to version control. Both `server/.env` and `client/.env` are ignored in `.gitignore`.

---

## Database Setup & Admin Bootstrap

To initialize the database with an Organization, Primary IT Department, default service categories, and an initial `SYSTEM_ADMIN` user:

```bash
cd server
npm run bootstrap
```

This creates:
- **Organization**: `Acme Corporation` (slug: `acme-corp`)
- **Department**: `Information Technology` (code: `IT`)
- **Default Categories**: Hardware & Workstations, Network & Connectivity, Software Applications, Identity & Access Management
- **Default Admin Account**:
  - **Email**: `admin@servicedesk.local`
  - **Password**: `Admin@123456`
  - **Role**: `SYSTEM_ADMIN`

You can also specify custom credentials during bootstrap:
```bash
node scripts/bootstrapAdmin.js customadmin@company.com MyStrongPassword123! John Doe
```

---

## Running the Application

### Development Mode

1. **Start the Express API Server** (Port `5000`):
   ```bash
   cd server
   npm run dev
   ```

2. **Start the Vite Frontend Development Server** (Port `5173`):
   ```bash
   cd client
   npm run dev
   ```

3. **Access the Application**:
   Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Running Tests & Quality Checks

### 1. Server Unit & Integration Tests (96 Tests across 5 Suites)
```bash
cd server
npm test
```
Verifies JWT authentication, login pipelines, RBAC authorization, department access boundaries, SLA state machines, comment privacy, work log validation, asset custody lifecycles, and audit logging.

### 2. Client Tests (38 Tests across 13 Suites)
```bash
cd client
npm test
```
Verifies API client interceptors, ticket operations, asset operations, knowledge base operations, AI triage classification, KB recommendation queries, report metrics aggregation, CSV export formatting, and route access guards.

### 3. Frontend Linting (ESLint)
```bash
cd client
npm run lint
```

### 4. Frontend Production Build
```bash
cd client
npm run build
```

---

## Production Deployment Guide

### 1. Database (MongoDB Atlas)
1. Provision a MongoDB Atlas M10+ cluster.
2. Under **Network Access**, whitelist your application server IP or select VPC peering.
3. Under **Database Access**, create a dedicated database user with `readWrite` permissions on `servicedesk_pro`.
4. Copy the SRV connection string into `server/.env`:
   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/servicedesk_pro?retryWrites=true&w=majority
   ```

### 2. Express Backend Deployment
1. Set production environment variables in your hosting provider (e.g. AWS ECS, Render, Railway, DigitalOcean):
   - `NODE_ENV=production`
   - `PORT=5000`
   - `MONGODB_URI=<your_atlas_connection_string>`
   - `JWT_SECRET=<generate_high_entropy_random_string_64_bytes>`
   - `CORS_ORIGIN=https://servicedesk.yourdomain.com`
2. Run database bootstrap on deployment:
   ```bash
   npm run bootstrap
   ```
3. Start the production server:
   ```bash
   npm start
   ```
4. Verify server health:
   ```bash
   curl -I https://api.yourdomain.com/api/health
   ```

### 3. Frontend Deployment (React / Vite)
1. Set the API URL in `client/.env.production`:
   ```env
   VITE_API_BASE_URL=https://api.yourdomain.com/api
   ```
2. Build the production client bundle:
   ```bash
   cd client
   npm run build
   ```
3. Deploy the resulting `client/dist/` directory to a static CDN host (e.g. Cloudflare Pages, AWS CloudFront + S3, Vercel).
4. Configure SPA routing fallback so that all non-file route requests return `index.html`.

---

## Known Limitations & Future Roadmap

| Area | Current Implementation | Production Enhancement Roadmap |
|---|---|---|
| **AI Classification** | Client-side heuristic triage engine matching urgency phrases and active organization categories. | Implement dedicated `POST /api/ai/classify` endpoint connecting to an enterprise LLM (e.g. Google Vertex AI) with asynchronous background processing. |
| **Reports Aggregation** | Client-side live metric aggregation over ticket and asset endpoints. | Implement native MongoDB aggregation pipelines (`$facet`, `$group`, `$bucket`) on the backend for organizations with >10,000 records. |
| **Object Storage** | Local filesystem storage (`uploads/attachments`) with path traversal guards. | Configure cloud object storage (e.g., AWS S3, Cloudflare R2) using pre-signed upload URLs for zero-downtime server scaling. |
| **WebSockets** | Polling and event-driven updates. | Integrate Socket.io for instantaneous ticket comments and live technician queue assignments. |

---

## Documentation Index

- [Database Design Documentation](docs/database-design.md) — Complete 13-collection Mongoose schema documentation.
- [REST API Reference](docs/api-documentation.md) — Comprehensive endpoint specifications and sample payloads.
- [User Guide (5 Roles)](docs/user-guide.md) — Operational walkthrough for Admins, Managers, Technicians, Asset Managers, and Employees.
- [Demo Walkthrough & Scenarios](docs/demo-walkthrough.md) — End-to-end evaluation script with non-sensitive sample data.
