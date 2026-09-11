# Audit Logging System Specification — Altus Kairos

## 1. Purpose

Every mutation impacting student status, financial records, attendance overrides, or system configuration must be recorded in an immutable `AuditLog` table.

## 2. AuditLog Schema Attributes

- `id`: Unique identifier (CUID)
- `institutionId`: Scoped institution ID
- `userId`: ID of the authenticated user performing the action (nullable for system actions)
- `action`: Domain action enum/string (e.g. `STUDENT_CREATED`, `STUDENT_TRANSFERRED`, `STUDENT_WITHDRAWN`, `ATTENDANCE_MARKED`, `ATTENDANCE_CLEARED`, `CONFIG_UPDATED`)
- `entityType`: Target entity (e.g. `Student`, `Enrollment`, `Attendance`, `InstitutionConfiguration`)
- `entityId`: Primary key of the affected entity
- `beforeData`: JSON snapshot of entity state prior to mutation
- `afterData`: JSON snapshot of entity state following mutation
- `ipAddress`: Client IP address from request headers
- `userAgent`: Client user-agent string
- `createdAt`: UTC timestamp

## 3. Immutability

Audit log rows cannot be updated or deleted via application APIs.
