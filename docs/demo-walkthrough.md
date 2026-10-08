# ServiceDesk Pro — End-to-End Demo Walkthrough

This document outlines a complete, step-by-step demonstration walkthrough of ServiceDesk Pro using safe, non-sensitive demo scenarios.

---

## Demo Credentials & Setup

Run the bootstrap command to seed the test organization and system administrator:
```bash
cd server
npm run bootstrap
```

### Bootstrap Credentials:
- **Email**: `admin@servicedesk.local`
- **Password**: `Admin@123456`
- **Role**: `SYSTEM_ADMIN`
- **Organization**: `Acme Corporation` (slug: `acme-corp`)

---

## Scenario 1: Administrator Login & Dashboard Overview

1. Open your browser and navigate to `http://localhost:5173/login`.
2. Enter email `admin@servicedesk.local` and password `Admin@123456`.
3. Click **Sign In**.
4. Observe:
   - Successful authentication and immediate redirect to `/dashboard`.
   - Top banner displays: *"Welcome back, System Administrator"* with role badge `SYSTEM_ADMIN`.
   - Operational KPI summary cards display active ticket counts, SLA compliance rate, and unassigned queues.
   - Sidebar displays all authorized navigation modules: **Dashboard**, **Ticket Management**, **Assets & Vendors**, **Knowledge Base**, **Analytics & SLA**, and **Administration**.

---

## Scenario 2: Ticket Creation with AI Triage & Knowledge Suggestions

1. Navigate to **Ticket Management** (`/tickets`) and click **+ New Ticket**.
2. In the **Subject** field, enter:
   `"Critical production database connection timeout impacting all users"`
3. In the **Description** field, enter:
   `"Application services cannot reach the cluster on port 5432 after network router upgrade. Immediate outage across customer portals."`
4. Observe the **AI Triage Suggestion Banner**:
   - Priority detected: `CRITICAL` (with high confidence >90%).
   - Diagnosis analysis: *"High-impact incident: potential service interruption or system outage"*.
   - Suggested category match: *"Network & Connectivity"*.
5. Click **Apply** in the AI banner:
   - Notice the Priority dropdown instantly sets to `Critical` and the Category dropdown selects `Network & Connectivity` without manual entry.
6. Notice the **Recommended Solution Guides** banner:
   - Recommends published troubleshooting guides based on the query keywords.
7. Click **Create Ticket**:
   - The ticket is saved, assigned a unique sequence number (e.g. `SDP-2026-0001`), and opens in the directory with calculated SLA response and resolution countdowns.

---

## Scenario 3: Technician Diagnosis, Privacy & SLA State Machine

1. Click on the newly created ticket to open **Ticket Details** (`/tickets/:id`).
2. Review the right-hand context bar:
   - **SLA Status Card**: Shows target resolution time and remaining time badge.
   - **AI Triage Diagnostic Card**: Displays confidence rating and diagnostic analysis.
3. **Assign Ticket**:
   - Click **Assign**, select `System Administrator`, and confirm.
   - Notice the ticket status advances from `OPEN` to `ASSIGNED`.
4. **Begin Work**:
   - Click **Update Status** and select `IN_PROGRESS`.
5. **Add Internal Technician Note**:
   - In the conversation tab, type:
     `"Routing table trace indicates VLAN 10 switch port was toggled. Contacted network operations team to verify MAC table."`
   - Check the **Internal Note (Hidden from Requester)** checkbox.
   - Click **Post Comment**.
   - Notice the yellow/amber badge: *"Internal Note — Only visible to technicians and managers"*.
6. **Log Technician Time**:
   - Scroll to **Technician Work Logs**.
   - Enter `30` minutes and description: *"Investigated switchport configuration and verified routing tables"*.
   - Click **Add Work Log**.
7. **Pause SLA (Pending State)**:
   - Click **Update Status** and select `PENDING`.
   - Reason: *"Awaiting network ops port re-enablement"*.
   - Notice the SLA timer pauses, recording paused minutes to ensure technicians are not penalized.
8. **Resolve Ticket**:
   - Click **Update Status** and select `RESOLVED`.
   - Enter Resolution Notes: *"Re-enabled VLAN 10 tagging on switch port 4. Confirmed port 5432 connectivity."*
   - Enter Root Cause: *"Configuration drift during firmware upgrade"*.
   - The ticket displays the green **Resolution Summary** banner with resolver details and timestamp.

---

## Scenario 4: Hardware Asset Lifecycle & Ticket Linking

1. Navigate to **Assets & Vendors** (`/assets`).
2. Click **+ Add Asset**.
   - Tag: `AST-2026-9001`
   - Name: `Dell Latitude 5540 Developer Edition`
   - Type: `LAPTOP`
   - Category: `Workstation`
   - Cost: `$1,450.00`
   - Click **Register Asset**.
3. **Assign Asset to Custodian**:
   - Click on `AST-2026-9001` to view details.
   - Click **Assign Asset**, select custodian `System Administrator`, and condition `NEW`.
   - The asset status transitions to `ASSIGNED` and logs an initial custody assignment entry in the audit timeline.
4. **Link Asset to Ticket**:
   - Return to the previous ticket (`/tickets/:id`).
   - In the right-hand **Linked Hardware / Asset** card, click **Link**.
   - Select `AST-2026-9001 (Dell Latitude 5540)`.
   - The asset tag, status, and model are now permanently associated with the ticket for audit trails.
5. **Return Asset to Inventory**:
   - Open asset `AST-2026-9001` in `/assets/:id`.
   - Click **Return Asset**, select condition `GOOD`, and note: *"Returned after remote deployment"*.
   - The asset status returns to `IN_STOCK` and the custody history shows the complete check-out/check-in lifecycle.

---

## Scenario 5: Knowledge Base Self-Service & Feedback

1. Navigate to **Knowledge Base** (`/knowledge-base`).
2. Click **+ New Article**.
   - Title: *"VPN Troubleshooting & RADIUS Certificate Reset"*
   - Category: *"Network & Connectivity"*
   - Visibility: `PUBLIC`
   - Content: Provide step-by-step instructions for troubleshooting remote connection timeouts.
3. Click **Publish Article**:
   - Article becomes immediately live with status `PUBLISHED`.
4. Open the article details view:
   - Click the **Helpful** thumbs-up button.
   - Notice the helpful vote counter increments.

---

## Scenario 6: Operational Analytics & Report Exports

1. Navigate to **Analytics & SLA** (`/reports`).
2. Review the executive KPI summary cards:
   - **Total Tickets**: Shows live count of open vs. resolved tickets.
   - **SLA Compliance Rate**: Real calculation percentage reflecting breached vs. met deadlines.
   - **Net Avg Resolution**: Shows calculated hours for resolved issues, strictly excluding paused pending time.
   - **Asset Fleet Value**: Cumulative capital expenditure calculated from registered asset purchase costs.
3. Filter by Date Range:
   - Switch dropdown from `Past 30 Days` to `Past 7 Days` and `All Time`.
   - Observe real-time metric recalculation.
4. **Export Reports**:
   - Click **Export Tickets**: Downloads sanitized `servicedesk_tickets_YYYY-MM-DD.csv` with escaped fields and no leaked internal notes.
   - Click **Export Assets**: Downloads `servicedesk_assets_YYYY-MM-DD.csv` with formatted asset costs and custody dates.
   - Click **Print / PDF**: Opens the print-ready CSS report view.

---

## Scenario 7: Verifying Role Isolation (Employee Boundary Check)

1. Open an incognito browser window or log out.
2. Sign in as an `EMPLOYEE` account (or create a user with role `EMPLOYEE`).
3. Verify strict boundary enforcement:
   - **Navigation**: The sidebar only shows `Dashboard`, `My Tickets`, `My Equipment`, and `Knowledge Base`. `Analytics & SLA` and `Administration` are hidden.
   - **Direct URL Access**: If navigating directly to `/reports` or `/admin`, the `ProtectedRoute` intercepts the request and displays: *"Access Denied — You do not possess the required managerial privileges"*.
   - **Tickets**: Employee only sees tickets where they are the requester.
   - **Internal Notes**: Internal technician notes and technician work logs are completely absent from the ticket view.
   - **Attachments**: Downloading an internal attachment directly returns a 403 Forbidden error.
