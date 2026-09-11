# Institution Customization & Configuration Architecture — Altus Kairos

## 1. Principles of Customization

1. **Configuration Controls Behavior**: Feature flags, attendance rules, and academic policies reside in typed tables (`InstitutionConfiguration`), not in hardcoded route conditionals.
2. **Dynamic Custom Fields**: Dynamic attributes (`CustomField`, `CustomFieldValue`) provide entity-level schema flexibility without database migrations.

## 2. InstitutionConfiguration Schema

- `attendanceEnabled`: Enable/disable attendance tracking.
- `feesEnabled`: Enable/disable accounts & fee collection.
- `resultsEnabled`: Enable/disable examination results entry.
- `requireAcademicYear`: Require an active academic year for classes and enrollments.
- `allowMultipleSections`: Allow duplicate class names across distinct sections.
- `allowAttendanceEdit`: Allow past attendance modification.
- `attendanceLockDays`: Days after which attendance is locked against modification.

## 3. Dynamic Custom Field Standard

- Keys: `name`, `fieldKey`, `fieldType`, `options`, `placeholder`, `isRequired`, `isActive`, `sortOrder`, `section`.
- Types: `TEXT`, `NUMBER`, `DATE`, `SELECT`, `CHECKBOX`, `TEXTAREA`.
