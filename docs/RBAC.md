# Role-Based Access Control (RBAC) Specification — Altus Kairos

## 1. Core Model Structure

```text
User ────► Role ────► RolePermission ────► Permission
```

- **`Role`**: Scoped to an `Institution` (`ADMIN`, `PRINCIPAL`, `TEACHER`, `ACCOUNTANT`, `WARDEN`, `LIBRARIAN`).
- **`Permission`**: Granular string codes representing atomic actions.

## 2. Standard Permission Codes

```text
students.view
students.create
students.update
students.archive

classes.view
classes.create
classes.update
classes.archive

enrollment.view
enrollment.create
enrollment.transfer
enrollment.withdraw

attendance.view
attendance.mark
attendance.edit
attendance.clear

reports.view

configuration.view
configuration.update

users.view
users.manage

roles.view
roles.manage
```

## 3. Server-Side Enforcement

Every protected endpoint attaches `requirePermission(code)` middleware. Frontend visibility toggles are treated as UX affordances, never as security barriers.
