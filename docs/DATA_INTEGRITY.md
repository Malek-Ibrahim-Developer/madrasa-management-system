# Data Integrity & Domain Invariants — Altus Kairos

## 1. Academic Membership Invariant

For any given `(studentId, academicYearId)` pair:
- **Maximum one ACTIVE Enrollment** may exist at any time.
- Valid status transitions:
  - `ACTIVE` → `TRANSFERRED` (requires target class enrollment in same transaction)
  - `ACTIVE` → `WITHDRAWN` (requires `exitDate`)
  - `ACTIVE` → `COMPLETED` (end of academic session promotion)

## 2. Enrollment Date Effectiveness Rule

An enrollment is effective on business calendar date $D$ if and only if:
1. `D >= startOfDay(enrollment.enrollmentDate)`
2. `enrollment.exitDate IS NULL OR D <= startOfDay(enrollment.exitDate)`

## 3. Student.classId Legacy Field Deprecation Strategy

- `Student.classId` must never be queried for:
  - Daily attendance rosters
  - Historical reports or attendance statistics
  - Student promotion or academic standing
  - Result computations
- `Student.classId` is temporarily synchronized during mutations (`enrollStudent`, `transferStudent`, `withdrawStudent`) solely for backward compatibility with legacy read consumers.

## 4. Attendance Domain Invariant

- Attendance requires an active or historically effective `Enrollment` matching the requested `classId` and `date`.
- If an existing record's `enrollmentId` does not match the resolved enrollment for that date, updates are rejected with `409 ATTENDANCE_ENROLLMENT_MISMATCH`.
- Attendance records must never be altered to rewrite a student's past class affiliation.
- Unmarking attendance deletes the row inside the transaction; `null` status is never stored.
