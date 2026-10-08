# ServiceDesk Pro — User Guide (5 Roles)

This guide provides role-specific instructions for navigating and utilizing ServiceDesk Pro.

---

## Role Matrix Overview

| Feature / Area | SYSTEM_ADMIN | IT_MANAGER | TECHNICIAN | ASSET_MANAGER | EMPLOYEE |
|---|:---:|:---:|:---:|:---:|:---:|
| **Submit Tickets** | Yes | Yes | Yes | Yes | Yes (Self only) |
| **Manage & Assign Tickets** | Yes | Yes | Yes (Dept only) | View only | No |
| **Internal Notes & Work Logs** | Yes | Yes | Yes | No | No |
| **Change Ticket Status** | Yes | Yes | Yes | View only | Reopen (72h) |
| **Asset Check-out & Return** | Yes | Yes | No | Yes | View Assigned |
| **Manage Vendors** | Yes | Yes | View only | Yes | No |
| **Author Knowledge Articles** | Yes | Yes | Yes | View only | View Public |
| **View Reports & Export CSV** | Yes | Yes | No | Yes | No |
| **System Administration** | Yes | Yes | No | No | No |

---

## 1. System Administrator (`SYSTEM_ADMIN`)

The System Administrator holds organization-wide control over configuration, operational boundaries, security, and users.

### Key Responsibilities:
1. **Initial Bootstrap & Setup**:
   - Run `npm run bootstrap` to establish primary departments, categories, and administrator credentials.
   - Configure business hours and SLA escalation timers in `SlaPolicy`.
2. **User & Department Governance**:
   - Oversee organizational user accounts, active status toggles, and department mappings.
3. **Queue Reassignments & Incident Resolution**:
   - Reassign bottlenecked tickets across any organizational department.
   - Force ticket status transitions and supervise unresolved breaches.
4. **Fleet & Vendor Supervision**:
   - Register suppliers, audit equipment procurement values, and review asset lifecycle status.
5. **Analytics & Performance Monitoring**:
   - Access `/reports` to inspect organizational SLA compliance rates (target >= 95%), resolution velocity, and export compliance CSVs for auditing.

---

## 2. IT Manager (`IT_MANAGER`)

The IT Manager oversees day-to-day service desk operations, queue balancing, technician performance, and knowledge quality.

### Key Responsibilities:
1. **Queue Dispatch & Workload Balancing**:
   - Monitor the **Unassigned Queue** in `/tickets` and assign incoming tickets to technicians based on departmental capacity.
2. **SLA Monitoring & Escalation Mitigation**:
   - Track tickets marked with **Warning (80%)** or **Breached (100%)** badges.
   - Direct technician focus to prevent level-3 severe escalations.
3. **Knowledge Base Review & Publishing**:
   - Review draft articles submitted by technicians in `/knowledge-base`.
   - Transition high-value articles to `PUBLISHED` status to deflect repeat user inquiries.
4. **Reporting & Team Analytics**:
   - Review **Technician Active Workload** distribution bars on `/reports`.
   - Export CSV ticket logs filtered by date ranges (`7d`, `30d`, `90d`) for executive reporting.

---

## 3. Support Technician (`TECHNICIAN`)

Frontline IT staff responsible for diagnosing, working on, and resolving employee issues.

### Key Responsibilities:
1. **Managing Assigned Tickets**:
   - Access `/tickets` filtered to your assigned department queue.
   - Transition ticket from `ASSIGNED` to `IN_PROGRESS` when starting diagnosis.
2. **Collaborating via Conversation & Internal Notes**:
   - Send public replies to requesters to ask clarifying questions.
   - Use the **Internal Note** toggle to write technician-only diagnosis notes, error traces, or credentials without exposing them to the customer.
3. **Managing Customer Pending State (Pausing SLA)**:
   - When awaiting customer input or third-party hardware delivery, change status to `PENDING`. This pauses the active SLA resolution clock.
4. **Logging Labor & Time**:
   - Record minutes spent on tickets using the **Work Logs** tab.
5. **Resolving Issues with Root Cause Notes**:
   - Transition ticket to `RESOLVED` and provide clear **Resolution Notes** and root-cause analysis.
6. **Authoring Solutions**:
   - Create solution articles in `/knowledge-base` with troubleshooting steps.

---

## 4. Asset Manager (`ASSET_MANAGER`)

The Asset Manager controls physical hardware, virtual assets, software licenses, vendor contracts, and custody lifecycles.

### Key Responsibilities:
1. **Asset Intake & Tagging**:
   - Register new workstations, servers, and monitors in `/assets` with unique asset tags and serial numbers.
2. **Hardware Check-out & Custody**:
   - Issue equipment to new employees using the **Assign Asset** action.
   - Verify assigned custodian and location details.
3. **Hardware Returns & Inspections**:
   - Process equipment returns when employees depart or upgrade workstations.
   - Log return condition (`EXCELLENT`, `GOOD`, `DAMAGED`) and reset asset status to `IN_STOCK`.
4. **Vendor Directory**:
   - Maintain hardware manufacturers, warranty expiration dates, and vendor support contracts.
5. **Inventory Capital Auditing**:
   - Inspect total asset fleet procurement costs and hardware status breakdown on `/reports`.
   - Download the full `assets_inventory_YYYY-MM-DD.csv` for annual audit reporting.

---

## 5. Employee (`EMPLOYEE`)

Standard corporate employees requiring technical assistance or company equipment.

### Key Responsibilities:
1. **Submitting Support Requests**:
   - Click **New Ticket** on `/tickets` or `/dashboard`.
   - Enter subject and detailed description.
   - Review the **AI Triage Suggestion** and apply suggested categories with one click.
   - Check the **Recommended Solution Guides** box for immediate self-service answers before submitting.
2. **Tracking Ticket Progress**:
   - View your open support tickets in `/tickets`.
   - Communicate directly with assigned technicians by posting replies and screenshots.
3. **Reopening Resolved Tickets**:
   - If an issue recurs within 72 hours of a technician resolving it, click **Reopen Ticket**, provide the recurrence justification, and return the ticket to the active queue.
4. **Viewing Assigned Equipment**:
   - Navigate to `/assets` to inspect your assigned laptops, monitors, and equipment tags.
5. **Self-Service Knowledge Base**:
   - Search public guides in `/knowledge-base` and vote on helpful articles.
