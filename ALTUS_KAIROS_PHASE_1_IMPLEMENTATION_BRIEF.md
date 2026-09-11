# Altus Kairos --- Phase 1 Implementation Brief

## Institution Configuration + Development Role Context

**Repository:** `Malek-Ibrahim-Developer/madrasa-management-system`

------------------------------------------------------------------------

## 1. Objective

Implement the first foundation layer of the Madrasa Management System
without implementing the real login/password UI.

This phase must establish:

-   Institution Configuration as a first-class backend/frontend concept.
-   Institution module enable/disable flags.
-   Academic and attendance configuration rules.
-   A temporary Development Role Context for inspecting
    Admin/Teacher/etc. behavior.
-   Permission-based sidebar visibility.
-   Architecture that can later accept authenticated user/role context
    without rewriting business logic.

### Important product decision

**Do NOT implement login/password UI in this phase.**

Authentication is intentionally deferred until the ERP is substantially
complete.

Authorization architecture must still be designed now. The development
role is only a temporary development identity and is not production
authentication.

------------------------------------------------------------------------

# 2. Current architecture to preserve

The project uses:

-   React frontend
-   Express backend
-   Prisma
-   PostgreSQL
-   BrowserRouter
-   MainLayout / Sidebar / TopBar
-   centralized `AppError`
-   centralized error handler
-   Student / Class / Enrollment / Attendance architecture

### Academic authority

The authoritative academic membership model is:

``` text
AcademicYear
    ↓
Class
    ↓
Enrollment
    ↓
Student
```

Do not make `Student.classId` authoritative again.

### Error handling

Reuse:

``` text
server/src/utils/AppError.js
server/src/middleware/errorHandler.js
```

Do not create a second error-response system.

------------------------------------------------------------------------

# 3. Files to create/change

Recommended implementation:

``` text
server/
  prisma/
    schema.prisma                         CHANGE
  src/
    routes/
      institutionRoutes.js                CREATE
    services/
      institutionConfigurationService.js  CREATE
    middleware/
      devContext.js                       CREATE
  index.js                                CHANGE

src/
  App.jsx                                  CHANGE
  config/
    permissions.js                         CREATE
  context/
    DevRoleContext.jsx                     CREATE
    InstitutionContext.jsx                 CREATE
  components/
    layout/
      DevRoleSwitcher.jsx                 CREATE
      Sidebar.jsx                          CHANGE
      TopBar.jsx                           CHANGE if required
  pages/
    settings/
      InstitutionSettings.jsx              CREATE
```

Use the project's existing folder/import conventions if they differ. Do
not create duplicate infrastructure.

------------------------------------------------------------------------

# 4. Prisma --- InstitutionConfiguration

## File

`server/prisma/schema.prisma`

Preserve all existing fields and add the following module flags:

``` prisma
model InstitutionConfiguration {
  id                   String   @id @default(cuid())
  institutionId        String   @unique

  // Module availability
  studentsEnabled      Boolean  @default(true)
  coursesEnabled       Boolean  @default(true)
  attendanceEnabled    Boolean  @default(true)
  examsEnabled         Boolean  @default(true)
  feesEnabled          Boolean  @default(false)
  accountsEnabled      Boolean  @default(false)
  salaryEnabled        Boolean  @default(false)
  libraryEnabled       Boolean  @default(false)
  hostelEnabled        Boolean  @default(false)
  kitchenEnabled       Boolean  @default(false)

  // Academic rules
  requireAcademicYear  Boolean  @default(true)
  allowMultipleSections Boolean @default(true)

  // Attendance rules
  allowAttendanceEdit  Boolean  @default(true)
  attendanceLockDays   Int      @default(7)

  institution          Institution @relation(
    fields: [institutionId],
    references: [id],
    onDelete: Cascade
  )

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([institutionId])
}
```

### Critical

Do not blindly replace the existing model. Inspect it first and preserve
fields already present.

### Database safety

The project currently uses Prisma `db push` and does not have a reliable
migration history.

**Do not add startup SQL/DDL to `server/index.js`.**

Do not use:

``` js
prisma.$executeRawUnsafe(...)
```

during application startup for schema/index creation.

Run the project's normal Prisma workflow after editing the schema:

``` bash
cd server
npx prisma validate
npx prisma db push
```

Only report success if the commands actually pass.

------------------------------------------------------------------------

# 5. Institution Configuration Service

## Create

`server/src/services/institutionConfigurationService.js`

Use the project's existing Prisma client import. Do not create a second
Prisma client.

Core implementation:

``` js
const { prisma } = require("../db");
const AppError = require("../utils/AppError");

const CONFIG_KEYS = [
  "studentsEnabled",
  "coursesEnabled",
  "attendanceEnabled",
  "examsEnabled",
  "feesEnabled",
  "accountsEnabled",
  "salaryEnabled",
  "libraryEnabled",
  "hostelEnabled",
  "kitchenEnabled",
  "requireAcademicYear",
  "allowMultipleSections",
  "allowAttendanceEdit",
  "attendanceLockDays",
];

function validateConfigurationInput(input = {}) {
  const output = {};

  for (const key of CONFIG_KEYS) {
    if (input[key] !== undefined) {
      output[key] = input[key];
    }
  }

  for (const key of CONFIG_KEYS) {
    if (
      key !== "attendanceLockDays" &&
      output[key] !== undefined &&
      typeof output[key] !== "boolean"
    ) {
      throw new AppError(
        `${key} must be a boolean`,
        400,
        "INVALID_CONFIGURATION"
      );
    }
  }

  if (
    output.attendanceLockDays !== undefined &&
    (
      !Number.isInteger(output.attendanceLockDays) ||
      output.attendanceLockDays < 0 ||
      output.attendanceLockDays > 365
    )
  ) {
    throw new AppError(
      "Attendance lock days must be an integer between 0 and 365",
      400,
      "INVALID_CONFIGURATION"
    );
  }

  return output;
}

async function getInstitutionConfiguration(institutionId) {
  if (!institutionId) {
    throw new AppError(
      "Institution context is required",
      400,
      "INSTITUTION_CONTEXT_REQUIRED"
    );
  }

  return prisma.institutionConfiguration.upsert({
    where: { institutionId },
    create: { institutionId },
    update: {},
  });
}

async function updateInstitutionConfiguration(institutionId, input) {
  if (!institutionId) {
    throw new AppError(
      "Institution context is required",
      400,
      "INSTITUTION_CONTEXT_REQUIRED"
    );
  }

  const data = validateConfigurationInput(input);

  return prisma.institutionConfiguration.upsert({
    where: { institutionId },
    create: {
      institutionId,
      ...data,
    },
    update: data,
  });
}

module.exports = {
  CONFIG_KEYS,
  validateConfigurationInput,
  getInstitutionConfiguration,
  updateInstitutionConfiguration,
};
```

If the project exports Prisma differently, adapt only the import.

------------------------------------------------------------------------

# 6. Institution routes

## Create

`server/src/routes/institutionRoutes.js`

Required endpoints:

``` text
GET /api/institution/configuration
PUT /api/institution/configuration
GET /api/institution/profile
PUT /api/institution/profile
```

Configuration route:

``` js
const express = require("express");
const router = express.Router();

const AppError = require("../utils/AppError");

const {
  getInstitutionConfiguration,
  updateInstitutionConfiguration,
} = require("../services/institutionConfigurationService");

router.get("/configuration", async (req, res, next) => {
  try {
    const institutionId = req.devContext?.institutionId;

    if (!institutionId) {
      throw new AppError(
        "Institution context is required",
        400,
        "INSTITUTION_CONTEXT_REQUIRED"
      );
    }

    const data = await getInstitutionConfiguration(institutionId);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

router.put("/configuration", async (req, res, next) => {
  try {
    const institutionId = req.devContext?.institutionId;

    if (!institutionId) {
      throw new AppError(
        "Institution context is required",
        400,
        "INSTITUTION_CONTEXT_REQUIRED"
      );
    }

    const data = await updateInstitutionConfiguration(
      institutionId,
      req.body
    );

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
```

Add profile endpoints using the existing `Institution` model.

Only allow:

``` js
const PROFILE_KEYS = [
  "name",
  "description",
  "phone",
  "email",
  "address",
  "logoUrl",
];
```

Never allow normal profile updates to change:

``` text
id
code
status
createdAt
updatedAt
```

Do not create another Institution table.

------------------------------------------------------------------------

# 7. Register routes

## File

`server/index.js`

Add the import:

``` js
const institutionRoutes = require("./src/routes/institutionRoutes");
```

Register alongside the existing API routes:

``` js
app.use("/api/institution", institutionRoutes);
```

Keep the existing centralized error handler after the routes.

------------------------------------------------------------------------

# 8. Temporary development institution context

Authentication is deferred, but the backend must still have a
deterministic institution context.

## Create

`server/src/middleware/devContext.js`

Implementation:

``` js
function devContext(req, res, next) {
  if (process.env.NODE_ENV === "production") {
    return next();
  }

  req.devContext = {
    institutionId: process.env.DEV_INSTITUTION_ID || null,
    role: process.env.DEV_ROLE || "ADMIN",
  };

  next();
}

module.exports = devContext;
```

Register this middleware before institution routes.

### Security rule

Never accept arbitrary client-supplied institution IDs like:

``` json
{
  "institutionId": "another-institution"
}
```

Do not use:

``` js
prisma.institution.findFirst()
```

as an implicit fallback.

If no `DEV_INSTITUTION_ID` exists, fail clearly with:

``` text
INSTITUTION_CONTEXT_REQUIRED
```

This temporary context will later be replaced with:

``` js
req.user.institutionId
```

after real authentication is implemented.

------------------------------------------------------------------------

# 9. Development permissions

## Create

`src/config/permissions.js`

Use stable permission codes:

``` js
export const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard.view",

  STUDENTS_VIEW: "students.view",
  STUDENTS_CREATE: "students.create",
  STUDENTS_EDIT: "students.edit",
  STUDENTS_DELETE: "students.delete",

  COURSES_VIEW: "courses.view",
  COURSES_MANAGE: "courses.manage",

  ATTENDANCE_VIEW: "attendance.view",
  ATTENDANCE_MARK: "attendance.mark",
  ATTENDANCE_EDIT: "attendance.edit",

  EXAMS_VIEW: "exams.view",
  EXAMS_MANAGE: "exams.manage",

  FEES_VIEW: "fees.view",
  FEES_MANAGE: "fees.manage",

  ACCOUNTS_VIEW: "accounts.view",
  ACCOUNTS_MANAGE: "accounts.manage",

  SALARY_VIEW: "salary.view",
  SALARY_MANAGE: "salary.manage",

  LIBRARY_VIEW: "library.view",
  LIBRARY_MANAGE: "library.manage",

  HOSTEL_VIEW: "hostel.view",
  HOSTEL_MANAGE: "hostel.manage",

  KITCHEN_VIEW: "kitchen.view",
  KITCHEN_MANAGE: "kitchen.manage",

  SETTINGS_VIEW: "settings.view",
  SETTINGS_MANAGE: "settings.manage",
};

export const DEV_ROLES = {
  ADMIN: "ADMIN",
  TEACHER: "TEACHER",
  ACCOUNTANT: "ACCOUNTANT",
  LIBRARIAN: "LIBRARIAN",
  HOSTEL_WARDEN: "HOSTEL_WARDEN",
  KITCHEN_MANAGER: "KITCHEN_MANAGER",
  STAFF: "STAFF",
};

export const ROLE_PERMISSIONS = {
  ADMIN: Object.values(PERMISSIONS),

  TEACHER: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.STUDENTS_VIEW,
    PERMISSIONS.COURSES_VIEW,
    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.ATTENDANCE_MARK,
    PERMISSIONS.ATTENDANCE_EDIT,
    PERMISSIONS.EXAMS_VIEW,
  ],

  ACCOUNTANT: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.FEES_VIEW,
    PERMISSIONS.FEES_MANAGE,
    PERMISSIONS.ACCOUNTS_VIEW,
    PERMISSIONS.ACCOUNTS_MANAGE,
    PERMISSIONS.SALARY_VIEW,
  ],

  LIBRARIAN: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.LIBRARY_VIEW,
    PERMISSIONS.LIBRARY_MANAGE,
  ],

  HOSTEL_WARDEN: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.HOSTEL_VIEW,
    PERMISSIONS.HOSTEL_MANAGE,
    PERMISSIONS.STUDENTS_VIEW,
  ],

  KITCHEN_MANAGER: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.KITCHEN_VIEW,
    PERMISSIONS.KITCHEN_MANAGE,
  ],

  STAFF: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.STUDENTS_VIEW,
  ],
};
```

Do not use display labels for authorization.

------------------------------------------------------------------------

# 10. DevRoleContext

## Create

`src/context/DevRoleContext.jsx`

``` jsx
import {
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";

import {
  DEV_ROLES,
  ROLE_PERMISSIONS,
} from "../config/permissions";

const STORAGE_KEY = "altus-kairos-dev-role";

const DevRoleContext = createContext(null);

export function DevRoleProvider({ children }) {
  const [currentRole, setCurrentRole] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);

    return Object.values(DEV_ROLES).includes(stored)
      ? stored
      : DEV_ROLES.ADMIN;
  });

  const changeRole = (role) => {
    if (!Object.values(DEV_ROLES).includes(role)) {
      return;
    }

    localStorage.setItem(STORAGE_KEY, role);
    setCurrentRole(role);
  };

  const permissions = ROLE_PERMISSIONS[currentRole] || [];

  const value = useMemo(
    () => ({
      currentRole,
      permissions,
      changeRole,

      hasPermission: (permission) =>
        permissions.includes(permission),

      hasAnyPermission: (required) =>
        required.some((permission) =>
          permissions.includes(permission)
        ),

      hasAllPermissions: (required) =>
        required.every((permission) =>
          permissions.includes(permission)
        ),
    }),
    [currentRole, permissions]
  );

  return (
    <DevRoleContext.Provider value={value}>
      {children}
    </DevRoleContext.Provider>
  );
}

export function useDevRole() {
  const context = useContext(DevRoleContext);

  if (!context) {
    throw new Error(
      "useDevRole must be used inside DevRoleProvider"
    );
  }

  return context;
}
```

------------------------------------------------------------------------

# 11. Add provider

## File

`src/App.jsx`

Wrap the existing application with:

``` jsx
<DevRoleProvider>
  <BrowserRouter>
    {/* existing application */}
  </BrowserRouter>
</DevRoleProvider>
```

Import:

``` js
import { DevRoleProvider } from "./context/DevRoleContext";
```

Do not add authentication redirects.

Do not remove existing routes.

------------------------------------------------------------------------

# 12. InstitutionContext

## Create

`src/context/InstitutionContext.jsx`

Centralize configuration fetching.

Expose:

``` text
institution
configuration
loading
error
refreshConfiguration
hasModule
```

Example:

``` jsx
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const InstitutionContext = createContext(null);

export function InstitutionProvider({ children }) {
  const [institution, setInstitution] = useState(null);
  const [configuration, setConfiguration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refreshConfiguration = async () => {
    setLoading(true);
    setError(null);

    try {
      const [profileResponse, configResponse] =
        await Promise.all([
          fetch("/api/institution/profile"),
          fetch("/api/institution/configuration"),
        ]);

      if (!profileResponse.ok || !configResponse.ok) {
        throw new Error("Unable to load institution configuration");
      }

      const profileJson = await profileResponse.json();
      const configJson = await configResponse.json();

      setInstitution(profileJson.data);
      setConfiguration(configJson.data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshConfiguration();
  }, []);

  const value = useMemo(
    () => ({
      institution,
      configuration,
      loading,
      error,
      refreshConfiguration,
      hasModule: (key) =>
        configuration?.[key] === true,
    }),
    [
      institution,
      configuration,
      loading,
      error,
    ]
  );

  return (
    <InstitutionContext.Provider value={value}>
      {children}
    </InstitutionContext.Provider>
  );
}

export function useInstitution() {
  const context = useContext(InstitutionContext);

  if (!context) {
    throw new Error(
      "useInstitution must be used inside InstitutionProvider"
    );
  }

  return context;
}
```

Adapt the fetch helper if the project already has one.

Do not create duplicate API clients if one already exists.

------------------------------------------------------------------------

# 13. Add InstitutionProvider

Wrap the application:

``` jsx
<DevRoleProvider>
  <InstitutionProvider>
    <BrowserRouter>
      ...
    </BrowserRouter>
  </InstitutionProvider>
</DevRoleProvider>
```

Either provider can be outside the router depending on project
conventions. The important requirement is that Sidebar, Settings, and
other consumers share one configuration state.

------------------------------------------------------------------------

# 14. Sidebar

## File

`src/components/layout/Sidebar.jsx`

The current navigation is static.

Convert each item into a definition containing:

``` text
label
path
permission
module
```

Example:

``` js
{
  label: "Attendance",
  path: "/attendance",
  permission: PERMISSIONS.ATTENDANCE_VIEW,
  module: "attendanceEnabled",
}
```

Use:

``` js
const { hasPermission } = useDevRole();
const { configuration } = useInstitution();
```

Filter with:

``` js
const visibleItems = section.items.filter((item) => {
  const permissionAllowed =
    !item.permission ||
    hasPermission(item.permission);

  const moduleAllowed =
    !item.module ||
    configuration?.[item.module] !== false;

  return permissionAllowed && moduleAllowed;
});
```

Also hide an empty section:

``` js
const visibleSections = NAV_SECTIONS
  .map((section) => ({
    ...section,
    items: section.items.filter(/* same rule */),
  }))
  .filter((section) => section.items.length > 0);
```

### Important distinction

Module availability and permission are separate:

``` text
Module enabled
+
Permission granted
=
Visible
```

Do not replace one with the other.

------------------------------------------------------------------------

# 15. Dev Role Switcher

## Create

`src/components/layout/DevRoleSwitcher.jsx`

UI:

``` text
Role
[ Admin ▼ ]
```

Options:

``` text
Admin
Teacher
Accountant
Librarian
Hostel Warden
Kitchen Manager
Staff
```

Use:

``` js
const { currentRole, changeRole } = useDevRole();
```

Persist through the context.

Do not store credentials here.

Add the switcher to `TopBar.jsx` if that is where global user controls
belong.

Keep it visually compact and consistent with the existing design system.

------------------------------------------------------------------------

# 16. Institution Settings page

## Create

`src/pages/settings/InstitutionSettings.jsx`

Replace the existing `/settings` placeholder.

Sections:

### Institution

``` text
Name
Code (read-only)
Description
Phone
Email
Address
Logo
```

### Modules

``` text
Students
Courses
Attendance
Exams
Fees
Accounts
Salary
Library
Hostel
Kitchen
```

### Academic Rules

``` text
Require Academic Year
Allow Multiple Sections
```

### Attendance Rules

``` text
Allow Attendance Edit
Attendance Lock Days
```

Use existing UI components/styles where available.

Do not create an unrelated visual language.

------------------------------------------------------------------------

# 17. Settings save behavior

Use explicit save:

``` text
[Save Changes]
```

Flow:

``` text
Edit
 ↓
Client validation
 ↓
PUT /api/institution/configuration
 ↓
Success feedback
 ↓
Refresh configuration
 ↓
Sidebar updates
```

If saving fails:

-   retain unsaved local state
-   show an error
-   do not show success

Do not autosave every toggle.

------------------------------------------------------------------------

# 18. Settings route

## File

`src/App.jsx`

Replace the placeholder with:

``` jsx
<Route
  path="/settings"
  element={<InstitutionSettings />}
/>
```

Do not create a duplicate route.

------------------------------------------------------------------------

# 19. API validation tests

Test:

``` http
GET /api/institution/configuration
```

Expected:

``` json
{
  "success": true,
  "data": {}
}
```

Test:

``` http
PUT /api/institution/configuration
Content-Type: application/json

{
  "attendanceEnabled": false,
  "attendanceLockDays": 14
}
```

Expected:

``` text
200
```

Then GET again and verify persistence.

Invalid:

``` json
{
  "attendanceLockDays": -5
}
```

Expected:

``` text
400
INVALID_CONFIGURATION
```

Attempt:

``` json
{
  "institutionId": "another-id"
}
```

The client must not be allowed to switch institution context.

------------------------------------------------------------------------

# 20. Development role test matrix

Use this matrix:

  ---------------------------------------------------------------------------------------
  Role           Students   Attendance   Finance   Library    Hostel   Kitchen   Settings
  ------------ ---------- ------------ --------- --------- --------- --------- ----------
  Admin                 ✓            ✓         ✓         ✓         ✓         ✓          ✓

  Teacher               ✓            ✓         ✗         ✗         ✗         ✗          ✗

  Accountant            ✗            ✗         ✓         ✗         ✗         ✗          ✗

  Librarian             ✗            ✗         ✗         ✓         ✗         ✗          ✗

  Hostel                ✓            ✗         ✗         ✗         ✓         ✗          ✗
  Warden                                                                       

  Kitchen               ✗            ✗         ✗         ✗         ✗         ✓          ✗
  Manager                                                                      

  Staff                 ✓            ✗         ✗         ✗         ✗         ✗          ✗
  ---------------------------------------------------------------------------------------

This is development behavior, not the final production permission
policy.

------------------------------------------------------------------------

# 21. Module toggle tests

Example:

``` text
Admin
Attendance = OFF
```

Expected:

``` text
Attendance disappears from sidebar.
```

Then:

``` text
Attendance = ON
```

Expected:

``` text
Attendance returns.
```

Then:

``` text
Attendance = ON
Role = Staff
```

Expected:

``` text
Attendance remains hidden.
```

Because:

``` text
module enabled = true
permission = false
```

------------------------------------------------------------------------

# 22. UX requirements

Use:

-   existing typography
-   existing spacing
-   existing cards
-   existing buttons
-   existing icons
-   existing color tokens
-   responsive layout
-   clear loading state
-   clear saving state
-   clear error state

Avoid:

-   giant dashboard widgets
-   excessive gradients
-   random colors
-   unnecessary shadows
-   browser `alert()`
-   raw JSON UI
-   inconsistent button styles

The Settings page should look like part of Altus Kairos.

------------------------------------------------------------------------

# 23. Do not modify in this phase

Do NOT:

-   build login UI
-   build password flows
-   rewrite authentication
-   redesign Student/Enrollment architecture
-   rewrite Attendance
-   implement all ERP modules
-   add startup SQL
-   add arbitrary institution fallback
-   create duplicate Prisma clients
-   create another error handler
-   silently repair inconsistent data
-   make `Student.classId` authoritative
-   hardcode a production institution ID
-   scatter role-name checks throughout components

------------------------------------------------------------------------

# 24. Future authentication compatibility

Current:

``` text
DevRoleContext
      ↓
currentRole
      ↓
permission codes
```

Future:

``` text
Authenticated User
      ↓
User Role
      ↓
Role Permissions
```

Business components should continue to depend on:

``` js
hasPermission("students.edit")
```

rather than:

``` js
currentRole === "ADMIN"
```

This makes replacing the development identity with real authentication
much easier.

------------------------------------------------------------------------

# 25. Institution scoping rule

New institution-owned queries must always be institution scoped.

Avoid:

``` js
prisma.academicYear.findFirst({
  where: {
    isCurrent: true,
  },
});
```

Prefer:

``` js
prisma.academicYear.findFirst({
  where: {
    institutionId,
    isCurrent: true,
  },
});
```

Do not use a global first-record fallback.

------------------------------------------------------------------------

# 26. AcademicYear warning

The current AcademicYear schema has a globally unique `name`.

Do NOT casually change:

``` prisma
name String @unique
```

to:

``` prisma
@@unique([institutionId, name])
```

during this phase without a proper data migration strategy.

Academic Year hardening is a separate next phase.

------------------------------------------------------------------------

# 27. Verification checklist

### Database

-   [ ] Existing InstitutionConfiguration fields preserved.
-   [ ] Module flags added.
-   [ ] No startup DDL added.
-   [ ] `npx prisma validate` passes.
-   [ ] `npx prisma db push` actually succeeds.

### Backend

-   [ ] Institution routes registered.
-   [ ] Configuration GET works.
-   [ ] Configuration PUT works.
-   [ ] Profile GET works.
-   [ ] Profile PUT works.
-   [ ] Configuration validation works.
-   [ ] Arbitrary institution ID is rejected/ignored.
-   [ ] Missing dev institution context fails clearly.
-   [ ] Existing AppError/errorHandler is reused.

### Frontend

-   [ ] DevRoleProvider works.
-   [ ] Role persists across refresh.
-   [ ] Role switcher works.
-   [ ] Sidebar is permission-aware.
-   [ ] Sidebar is module-aware.
-   [ ] Settings page works.
-   [ ] Settings changes persist.
-   [ ] Loading state exists.
-   [ ] Saving state exists.
-   [ ] Error state exists.

### Regression

-   [ ] Dashboard opens.
-   [ ] Students opens.
-   [ ] Student profile opens.
-   [ ] Courses opens.
-   [ ] Attendance opens.
-   [ ] Custom Fields opens.
-   [ ] Existing routes are not removed accidentally.
-   [ ] No console errors.
-   [ ] No duplicate Prisma client.
-   [ ] No duplicate providers.

------------------------------------------------------------------------

# 28. Commands

Use the project's existing package manager/scripts.

Typical:

``` bash
cd server
npx prisma validate
npx prisma db push
```

Frontend:

``` bash
npm run build
```

If the project already has lint/test commands, run them.

Do not change dependency versions just to force the build to pass.

------------------------------------------------------------------------

# 29. Git / PR workflow

Prefer a feature branch:

``` text
feature/institution-configuration
```

Suggested commit:

``` text
feat: add institution configuration and dev role context
```

Suggested PR title:

``` text
feat: institution configuration and development role context
```

PR should clearly state:

### Included

-   Institution profile configuration
-   Module enable/disable configuration
-   Academic/attendance configuration
-   Development role context
-   Permission-aware navigation
-   Settings UI

### Not included

-   Real authentication
-   Login/password flow
-   Full production RBAC enforcement
-   Academic Year hardening
-   Enrollment redesign

------------------------------------------------------------------------

# 30. Exact implementation order

Follow this order:

``` text
1. Inspect existing schema and preserve current fields.
2. Add InstitutionConfiguration module flags.
3. Validate Prisma schema.
4. Create configuration service.
5. Create institution routes.
6. Register institution routes.
7. Create controlled development institution context.
8. Create frontend permission definitions.
9. Create DevRoleContext.
10. Add providers.
11. Add DevRoleSwitcher.
12. Add InstitutionContext/configuration state.
13. Convert Sidebar to permission + module filtering.
14. Replace Settings placeholder.
15. Build Settings UI.
16. Test configuration API.
17. Test all development roles.
18. Test module toggles.
19. Run build/validation/tests.
20. Review the final diff for unrelated changes.
```

Do not jump directly to UI before the backend configuration contract
exists.

------------------------------------------------------------------------

# 31. Definition of Done

This phase is complete only when:

> The institution can control which modules are enabled, those choices
> are persisted in the database, the Settings page can manage them, and
> the application can simulate different user roles whose navigation is
> determined by permission codes plus institution module availability.

Authentication is intentionally **not** part of Definition of Done.

------------------------------------------------------------------------

# 32. Next phase

After this phase:

``` text
Institution Configuration
        ↓
Development Authorization Context
        ↓
Academic Year Hardening
        ↓
Class Hardening
        ↓
Enrollment Hardening
        ↓
Student alignment
        ↓
Teachers
        ↓
Subjects
        ↓
Class Subjects / Teacher Assignment
        ↓
Attendance
        ↓
Exams
        ↓
Results
        ↓
Finance / Fees / Salary
        ↓
Library / Hostel / Kitchen
        ↓
Reports
        ↓
Dashboard
        ↓
Cross-module workflows
        ↓
Final hardening
        ↓
Real authentication
```

------------------------------------------------------------------------

## Final instruction to the IDE AI

**Inspect the existing code first.**

Do not treat this document as permission to rewrite the application.

Make the smallest clean architectural changes necessary.

Preserve working features.

Do not duplicate services, Prisma clients, contexts, error handlers, API
clients, or validation systems that already exist.

Do not silently modify unrelated files.

If an existing implementation conflicts with this brief, use the
existing project's established pattern where it is compatible and make
the smallest change necessary.

Most importantly:

**Never claim a feature is implemented until the relevant code exists
and the relevant validation/build/test command has actually passed.**
