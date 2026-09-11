# System Architecture Baseline — Altus Kairos Madrasa ERP

## 1. Overview & Core Philosophy

Altus Kairos is an enterprise-grade Madrasa Management System designed around a strict academic hierarchy:

```text
                    ┌────────────────────────┐
                    │ Institution             │
                    │ Configuration           │
                    └───────────┬────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │ Academic Year           │
                    └───────────┬────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │ Class                   │
                    └───────────┬────────────┘
                                │
                                ▼
Student ───────────────────► Enrollment (Authoritative Membership)
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
               Attendance                Results
                    │
                    ▼
          Historical Reports (Date-Aware)
```

## 2. Core Architectural Invariants

1. **Enrollment as Single Source of Truth**: Academic membership is governed exclusively by `Enrollment` records. `Student.classId` exists only as a temporary legacy cache.
2. **Historical Correctness**: Membership is determined by effective date intervals (`enrollmentDate <= D` and (`exitDate IS NULL` or `D <= exitDate`)), never solely by current `status: ACTIVE`.
3. **Multi-Tenant / Institution Foundation**: All academic years, classes, configurations, and users belong to an `Institution`.
4. **Server-Side Enforcement**: All authentication, sessions, permissions (RBAC), and validation are enforced on the server; client UI states are not authorization boundaries.
5. **Transactional Mutation Boundaries**: Critical updates (Enrollment, Transfer, Withdrawal, Attendance Marking, Configuration changes) execute inside atomic database transactions with appropriate locking.
6. **Audit Trail**: Every high-impact mutation produces an immutable `AuditLog` entry.

## 3. Directory Layout

- `server/src/services/`: Core business logic, transactional workflows, domain validation.
- `server/src/repositories/`: Encapsulated database queries.
- `server/src/middleware/`: Authentication, permission checking, error handling.
- `server/src/utils/`: Pure helper functions, date arithmetic, rule validators, `AppError`.
- `server/src/routes/`: Thin HTTP adapters mapping requests to services and returning standardized JSON.
- `src/`: React 19 client application with centralized design system tokens (`src/styles/variables.css`).
