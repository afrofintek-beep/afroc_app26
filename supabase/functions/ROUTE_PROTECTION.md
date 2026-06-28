# AFROLOC API Route Protection Summary

## Public Endpoints (No JWT Required)

| Endpoint | Function | Description |
|----------|----------|-------------|
| `/qg-engine` | QG Grid Engine | Generate QG codes from coordinates |
| `/sq-engine` | SQ Subdivision Engine | Generate SQ subdivision codes |
| `/address-gateway` | Public API Gateway | Testing/demo address operations |
| `/v1-docs` | API Documentation | Public API documentation |
| `/kpis-summary-csv` | KPIs Summary | Public KPI data (JSON + CSV) |
| `/kpis-timeseries-csv` | KPIs Timeseries | Public timeseries KPIs |
| `/kpis-by-province-csv` | KPIs by Province | Provincial KPI breakdown |
| `/kpis-growth-csv` | KPIs Growth | Growth metrics |
| `/kpis-by-admin-csv` | KPIs by Admin | Admin-level KPIs |
| `/csv-export` | CSV Export | General data export |
| `/auth` | Authentication | Login/refresh/logout |
| `/phone-login` | Phone Login | OTP-based phone login |
| `/biometric-login` | Biometric Login | Trusted device login |
| `/validate-signup` | Signup Validation | User registration |

## Protected Endpoints (JWT Required)

### Address Operations
| Endpoint | Required Roles | Description |
|----------|---------------|-------------|
| `/address-create` | `operator_field`, `admin_*`, `citizen` | Create new AFROLOC address |
| `/address-verify` | `operator_field`, `admin_*` | Verify address proximity |
| `/ats-score` | `operator_field`, `admin_*` | Calculate ATS score |
| `/ats-engine` | `operator_field`, `admin_*` | Full ATS calculation |
| `/batch-assign-qgsq` | `admin_national`, `admin_province` | Batch assign QG/SQ codes |

### Admin Operations
| Endpoint | Required Roles | Description |
|----------|---------------|-------------|
| `/admin-users` (list) | `admin_*` | List all users |
| `/admin-users` (create) | `admin_national` only | Create new users |
| `/admin-users` (update) | `admin_*` | Update user data |
| `/admin-users` (delete) | `admin_*` | Delete users |
| `/import-cell-towers` | `admin_national` | Import telecom tower data |

### Audit & Security
| Endpoint | Required Roles | Description |
|----------|---------------|-------------|
| `/audit-log` | `admin_*`, `auditor_read` | View audit logs |
| `/send-fraud-alert-email` | `admin_*` | Send fraud alerts |

### Telecom & Fusion
| Endpoint | Required Roles | Description |
|----------|---------------|-------------|
| `/telecom-fusion` | `operator_field`, `admin_*` | Telecom triangulation |

### Notifications
| Endpoint | Required Roles | Description |
|----------|---------------|-------------|
| `/notify-requester-validation` | Any authenticated | Notify validation status |
| `/send-validation-reminder` | `admin_*` | Send validation reminders |
| `/notify-witness-contract-download` | Any authenticated | Notify witness downloads |
| `/verify-witness-otp` | Any authenticated | Verify witness OTP |

## Role Hierarchy

```
admin_national (Level 5)
    └── admin_province (Level 4)
        └── admin_municipality (Level 3)
            └── operator_field (Level 2)
                └── citizen (Level 1)

auditor_read - Read-only access to audit logs
```

## Implementation Pattern

All protected endpoints use the shared `auth_rbac.ts` module:

```typescript
import {
  getCurrentUser,
  requireRoles,
  audit,
  errorResponse,
  jsonResponse,
} from "../_shared/auth_rbac.ts";

// In handler:
const currentUser = await getCurrentUser(req);
requireRoles(currentUser, "operator_field", "admin_national", "admin_province", "admin_municipality");
```
