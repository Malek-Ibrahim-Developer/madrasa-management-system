# ALTUS KAIROS — Courses Pagination Regression Fix Plan

## 1. Objective

Restore the **proper pagination UX on the Classes / Courses page** without changing any unrelated working functionality.

This fix must be treated as a **frontend regression repair**, not as a redesign.

The backend pagination contract is already present and should remain unchanged.

### Primary rule

> **Fix the defect, preserve unrelated behavior.**

The pagination regression must be fixed without modifying:

- Class creation behavior
- Class edit behavior
- Class deletion behavior
- Search behavior
- Status filters
- Modal behavior
- API response structure
- Backend class business rules
- Enrollment counting
- Existing responsive layout outside pagination
- Authentication / RBAC
- Any unrelated module

---

# 2. Current Problem

The Classes / Courses page currently shows a simplified pagination control:

```text
Showing Page 1 of 4 (37 total classes)

[ Previous ] [ Next ]
```

This is a regression from the intended pagination experience.

The proper pagination pattern already exists in the Students module and should be treated as the reference implementation.

The intended UX is:

```text
Showing 1–10 of 37 classes

Rows per page: [10 ▼]

[ Previous ] [ 1 ] [ 2 ] [ 3 ] [ 4 ] [ Next ]
```

For larger page counts:

```text
[ Previous ] [ 1 ] ... [ 5 ] [ 6 ] [ 7 ] ... [ 20 ] [ Next ]
```

On mobile:

```text
[ ← Prev ] [ Next → ]
```

Page number buttons may be hidden on smaller screens.

---

# 3. Root Cause

The backend class endpoint still returns proper server-side pagination metadata.

Current backend behavior in:

```text
server/src/routes/classRoutes.js
```

already supports:

```js
const page = Math.max(Number(req.query.page) || 1, 1);

const limit = Math.min(
  Math.max(Number(req.query.limit) || 50, 1),
  100
);
```

and returns:

```js
pagination: {
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit) || 1,
}
```

Therefore:

> **The backend pagination is not the regression.**

The regression is in the Courses frontend implementation.

Current file:

```text
src/pages/Courses.jsx
```

uses:

```js
const [page, setPage] = useState(1);
const [limit] = useState(10);
```

and renders only Previous / Next controls.

There is currently:

- No page-size selector
- No page-number buttons
- No ellipsis
- No record range
- No direct page navigation
- No canonical pagination behavior shared with Students

---

# 4. Files Involved

## Must modify

```text
src/pages/Courses.jsx
src/styles/courses.css
```

## Reference only — do not modify unless separately required

```text
src/pages/Students.jsx
src/styles/students.css
```

## Backend verification only — do not modify for this regression

```text
server/src/routes/classRoutes.js
```

---

# 5. Canonical Reference

The Students page already contains the expected pagination UX.

The Courses page should follow the same interaction model:

- Server-side pagination
- Current page state
- Rows-per-page selector
- Previous button
- Next button
- Page number buttons
- Ellipsis when pages are skipped
- Active page styling
- Disabled previous on first page
- Disabled next on last page
- Range display
- Responsive behavior

---

# 6. Required Changes — `src/pages/Courses.jsx`

## 6.1 Make page size editable

### Current

```js
const [limit] = useState(10);
```

### Replace with

```js
const [limit, setLimit] = useState(10);
```

This allows users to switch between 10, 25, 50, and 100 rows per page.

---

# 7. Preserve Existing Pagination Metadata State

Keep the existing pagination state:

```js
const [pagination, setPagination] = useState({
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 1,
});
```

The backend response should continue to update it:

```js
if (response?.pagination) {
  setPagination(response.pagination);
}
```

Do not invent frontend totals. Do not calculate total records from the currently loaded array. The backend metadata remains authoritative.

---

# 8. Derived Record Range

Add derived range values inside `Courses.jsx`:

```js
const startRange =
  pagination.total === 0
    ? 0
    : (pagination.page - 1) * pagination.limit + 1;

const endRange = Math.min(
  pagination.page * pagination.limit,
  pagination.total
);
```

Example:

```js
pagination = {
  page: 2,
  limit: 10,
  total: 37,
  totalPages: 4
}
```

UI:

```text
Showing 11–20 of 37 classes
```

For zero records, no impossible range such as `Showing 1–0 of 0` should appear.

---

# 9. Page Size Change Behavior

Add a page-size selector:

```jsx
<select
  className="page-size-select"
  value={limit}
  onChange={(e) => {
    setLimit(Number(e.target.value));
    setPage(1);
  }}
>
  <option value={10}>10</option>
  <option value={25}>25</option>
  <option value={50}>50</option>
  <option value={100}>100</option>
</select>
```

Whenever page size changes, `setPage(1)` must run. This prevents invalid-page requests after page-size changes.

---

# 10. Search and Filter Behavior

Existing behavior that resets pagination when search or status filters change must remain.

```js
setPage(1);
```

must continue to run when:

- Search changes
- Status filter changes

Pagination must always correspond to the filtered dataset.

---

# 11. Recommended Pagination JSX

Replace the simplified pagination block in `Courses.jsx` with the canonical pattern:

```jsx
{pagination.total > 0 && (
  <div className="pagination-bar">
    <div className="pagination-info">
      Showing <strong>{startRange}–{endRange}</strong>{' '}
      of <strong>{pagination.total}</strong> classes
    </div>

    <div className="pagination-controls">
      <div className="page-size-selector">
        <span className="page-size-label">Rows per page:</span>

        <select
          className="page-size-select"
          value={limit}
          onChange={(e) => {
            setLimit(Number(e.target.value));
            setPage(1);
          }}
        >
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>

      <div className="pagination-buttons">
        <button
          className="page-nav-btn"
          disabled={page === 1}
          onClick={() =>
            setPage((currentPage) => Math.max(currentPage - 1, 1))
          }
          title="Previous Page"
        >
          <MdChevronLeft />
          <span className="nav-text-mobile">Prev</span>
        </button>

        <div className="page-numbers-desktop">
          {Array.from(
            { length: pagination.totalPages },
            (_, index) => index + 1
          )
            .filter(
              (pageNumber) =>
                pageNumber === 1 ||
                pageNumber === pagination.totalPages ||
                Math.abs(pageNumber - page) <= 1
            )
            .reduce((items, pageNumber, index, visiblePages) => {
              if (
                index > 0 &&
                pageNumber - visiblePages[index - 1] > 1
              ) {
                items.push('...');
              }

              items.push(pageNumber);
              return items;
            }, [])
            .map((item, index) =>
              item === '...' ? (
                <span
                  key={`ellipsis-${index}`}
                  className="pagination-ellipsis"
                >
                  ...
                </span>
              ) : (
                <button
                  key={item}
                  className={`page-num-btn ${
                    item === page ? 'active' : ''
                  }`}
                  onClick={() => setPage(item)}
                >
                  {item}
                </button>
              )
            )}
        </div>

        <button
          className="page-nav-btn"
          disabled={
            page === pagination.totalPages ||
            pagination.totalPages === 0
          }
          onClick={() =>
            setPage((currentPage) =>
              Math.min(currentPage + 1, pagination.totalPages)
            )
          }
          title="Next Page"
        >
          <span className="nav-text-mobile">Next</span>
          <MdChevronRight />
        </button>
      </div>
    </div>
  </div>
)}
```

---

# 12. Why `pagination.total > 0` Is Better Than `totalPages > 1`

The old UI condition:

```js
pagination.totalPages > 1
```

hides pagination information entirely when only one page exists.

With six classes and 10 rows/page, the user should still see:

```text
Showing 1–6 of 6 classes
Rows per page: 10
```

So prefer:

```jsx
{pagination.total > 0 && (...)}
```

---

# 13. Optional Improvement — Safe Page Correction

If the current page becomes invalid because the dataset shrinks, correct it safely:

```js
if (response?.pagination) {
  setPagination(response.pagination);

  if (
    response.pagination.totalPages > 0 &&
    page > response.pagination.totalPages
  ) {
    setPage(response.pagination.totalPages);
  }
}
```

This is optional but recommended. Verify that it does not create a repeated fetch loop.

---

# 14. Styling — `src/styles/courses.css`

The Courses page currently uses simplified classes such as:

```text
.pagination-actions
.btn-pagination
```

The Courses pagination should align with the Students pagination classes:

```text
.pagination-bar
.pagination-info
.pagination-controls
.page-size-selector
.page-size-label
.page-size-select
.pagination-buttons
.page-nav-btn
.page-numbers-desktop
.page-num-btn
.page-num-btn.active
.pagination-ellipsis
.nav-text-mobile
```

Use the existing Students visual language rather than creating a new pagination design.

---

# 15. CSS Structure

A suitable structure is:

```css
.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 16px 0;
}

.pagination-info {
  font-size: 14px;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 20px;
}

.page-size-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-size-label {
  font-size: 14px;
  white-space: nowrap;
}

.page-size-select {
  min-width: 68px;
  padding: 7px 28px 7px 10px;
  border-radius: 8px;
  cursor: pointer;
}

.pagination-buttons {
  display: flex;
  align-items: center;
  gap: 6px;
}

.page-nav-btn,
.page-num-btn {
  min-height: 36px;
  min-width: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  cursor: pointer;
}

.page-nav-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.page-num-btn.active {
  font-weight: 600;
}

.page-numbers-desktop {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pagination-ellipsis {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
}
```

Do not blindly paste generic colors. Exact colors, borders, backgrounds, hover/focus states, shadows, and spacing should match the existing Students pagination and Altus Kairos design system.

---

# 16. Responsive Behavior

At smaller viewport widths, hide direct page numbers if necessary:

```css
@media (max-width: 640px) {
  .page-numbers-desktop {
    display: none;
  }

  .pagination-bar {
    align-items: stretch;
  }

  .pagination-controls {
    width: 100%;
    justify-content: space-between;
  }
}
```

Expected mobile behavior:

```text
Showing 11–20 of 37 classes
Rows per page: [10]
[ ← Prev ]              [ Next → ]
```

Do not allow horizontal overflow.

---

# 17. Backend — No Functional Change Required

`server/src/routes/classRoutes.js` already accepts `page` and `limit` and returns pagination metadata.

Verify only that the frontend continues to call:

```js
getClasses({
  search: searchTerm,
  status: statusFilter,
  page,
  limit,
});
```

The only relevant frontend state change is that `limit` becomes dynamic.

---

# 18. API Contract Must Stay Unchanged

Keep the expected response shape:

```json
{
  "data": [
    {
      "id": "...",
      "name": "Class 1"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 37,
    "totalPages": 4
  }
}
```

Do not rename:

```text
data
pagination
page
limit
total
totalPages
```

---

# 19. Pagination Logic Examples

## Case A — 37 records, 10/page

Page 1:

```text
Showing 1–10 of 37 classes
```

Page 2:

```text
Showing 11–20 of 37 classes
```

Page 4:

```text
Showing 31–37 of 37 classes
```

## Case B — 6 records, 10/page

```text
Showing 1–6 of 6 classes
```

Previous disabled. Next disabled.

## Case C — 0 records

No invalid pagination should appear.

## Case D — 200 records, current page 10

```text
[ Prev ] [ 1 ] ... [ 9 ] [ 10 ] [ 11 ] ... [ 20 ] [ Next ]
```

Do not display every page button.

---

# 20. Page Number Rules

Visible page calculation should normally show:

- First page
- Last page
- Current page
- One page before current
- One page after current
- Ellipsis when a gap exists

Examples:

```text
Current 1 of 10: 1 2 ... 10
Current 2 of 10: 1 2 3 ... 10
Current 5 of 10: 1 ... 4 5 6 ... 10
Current 9 of 10: 1 ... 8 9 10
Current 10 of 10: 1 ... 9 10
```

---

# 21. Do Not Display Impossible Pages

Pagination must never generate:

```text
Page 0
Page -1
Page 11 of 10
```

Previous must be disabled at the first page. Next must be disabled at the last page.

---

# 22. Loading Behavior

When moving from page 1 to page 2:

1. `setPage(2)`
2. `fetchClasses()` runs
3. API receives `page=2`
4. Table updates with page 2 data
5. Pagination metadata updates

Do not mix client-side array slicing with server-side pagination.

Incorrect if the backend already returns only the requested page:

```js
classes.slice(...)
```

---

# 23. Search + Pagination Flow

```text
User types search
        ↓
setPage(1)
        ↓
GET /api/classes?search=...&page=1&limit=10
        ↓
Backend filters and counts
        ↓
Backend returns requested page
        ↓
UI renders records + pagination
```

Do not search only within the currently loaded page.

---

# 24. Filter + Pagination Flow

```text
Status filter changes
        ↓
setPage(1)
        ↓
GET /api/classes?status=ACTIVE&page=1&limit=10
        ↓
Backend returns filtered result
```

Do not filter only the currently loaded frontend page and treat it as the whole dataset.

---

# 25. Regression Guardrails

## Do NOT modify:

```text
Class create form
Class edit modal
Class delete flow
Class status logic
Enrollment logic
Academic year rules
Capacity validation
Tenant filtering
API error handling
Search semantics
Status filter semantics
Class cards / table structure
```

unless a pagination dependency requires a tiny targeted adjustment.

---

# 26. No Broad File Rewrite

The implementation agent must **not rewrite the entire `Courses.jsx` file**.

Bad approach:

```text
Regenerate Courses.jsx from scratch
```

Preferred approach:

```text
1. Change limit state
2. Add range calculation
3. Replace pagination JSX only
4. Adjust pagination CSS only
```

This minimizes regressions.

---

# 27. Preserve Existing Imports

`Courses.jsx` already imports:

```js
MdChevronLeft
MdChevronRight
```

Reuse them. Do not introduce another icon library.

---

# 28. CSS Regression Safety

When modifying `src/styles/courses.css`, do not globally redefine selectors such as:

```css
button
select
div
span
```

Pagination styles should stay scoped to pagination classes to avoid affecting forms, modals, filters, or action controls.

---

# 29. Recommended Future Refactor — Not Required in This Fix

Long-term, Students and Courses should share a reusable pagination component such as:

```text
src/components/common/Pagination.jsx
```

Possible API:

```jsx
<Pagination
  page={page}
  pageSize={limit}
  total={pagination.total}
  totalPages={pagination.totalPages}
  onPageChange={setPage}
  onPageSizeChange={(size) => {
    setLimit(size);
    setPage(1);
  }}
/>
```

Potential consumers:

```text
Students
Classes
Teachers
Staff
Attendance
Fees
Exams
Admissions
Audit Logs
```

But do **not** include this refactor in the immediate regression fix unless explicitly approved.

---

# 30. Test Plan

## Test 1 — first page

Data: 37 classes, 10 per page.

Expected:

```text
Showing 1–10 of 37 classes
```

Previous disabled. Page 1 active.

## Test 2 — next page

Click Next.

Expected request:

```text
page=2&limit=10
```

Expected range:

```text
Showing 11–20 of 37 classes
```

## Test 3 — previous page

From page 2 click Previous. Expected page 1 and Previous disabled.

## Test 4 — direct page navigation

Click page 3.

Expected:

```text
page=3&limit=10
Showing 21–30 of 37 classes
```

## Test 5 — last page

Expected:

```text
Showing 31–37 of 37 classes
```

Next disabled.

## Test 6 — page size 25

Select 25.

Expected:

```text
page resets to 1
limit=25
Showing 1–25 of 37 classes
```

## Test 7 — page size 50

Expected:

```text
Showing 1–37 of 37 classes
```

One page only. Previous and Next disabled.

## Test 8 — search reset

Go to page 3, then enter search. Expected page resets to 1.

## Test 9 — status filter reset

Go to page 3, change status. Expected page resets to 1.

## Test 10 — no results

Expected:

```text
No invalid pagination
No "Showing 1–0"
No negative range
No enabled Next button
```

## Test 11 — large pagination

With 20 pages, current page 10:

```text
1 ... 9 10 11 ... 20
```

## Test 12 — mobile

At `<= 640px`:

- No horizontal overflow
- Direct page-number group hidden if configured
- Previous visible
- Next visible
- Page-size selector usable
- Range text readable

---

# 31. Network Verification

Browser DevTools → Network.

Verify requests such as:

```http
GET /api/classes?page=1&limit=10
GET /api/classes?page=2&limit=10
GET /api/classes?page=1&limit=25
GET /api/classes?search=math&page=1&limit=10
GET /api/classes?status=ACTIVE&page=1&limit=10
```

Do not accept a frontend-only illusion where page buttons change but the API remains on page 1.

---

# 32. Acceptance Criteria

## Functional

- [ ] Courses pagination uses server-side data.
- [ ] Previous works.
- [ ] Next works.
- [ ] Direct page numbers work.
- [ ] Active page is clearly visible.
- [ ] Ellipsis works.
- [ ] Rows-per-page selector works.
- [ ] Page size change resets page to 1.
- [ ] Search resets page to 1.
- [ ] Status filter resets page to 1.
- [ ] Correct record range is shown.
- [ ] No impossible pages appear.
- [ ] First page disables Previous.
- [ ] Last page disables Next.

## Visual

- [ ] Pagination matches Students module.
- [ ] Desktop layout is clean.
- [ ] Mobile layout does not overflow.
- [ ] Styling matches Altus Kairos.
- [ ] No unrelated buttons/styles change.

## Regression

- [ ] Class creation still works.
- [ ] Class editing still works.
- [ ] Class deletion still works.
- [ ] Search still works.
- [ ] Status filters still work.
- [ ] Class data rendering remains unchanged.
- [ ] API response contract remains unchanged.
- [ ] No backend business rules were changed.

---

# 33. Definition of Done

This issue is complete when the Classes page once again provides the same proper pagination experience already used in the Students page, with:

- Correct backend queries
- Correct range metadata
- Direct page buttons
- Ellipsis
- Correct disabled states
- Rows-per-page options
- Responsive behavior
- No unrelated regressions

---

# 34. Implementation Priority

## P0 — Required

1. Make `limit` state editable.
2. Add range calculation.
3. Restore rows-per-page selector.
4. Restore previous / page number / next controls.
5. Restore ellipsis behavior.
6. Match Students pagination styling.
7. Keep search/filter page reset.
8. Preserve backend pagination contract.

## P1 — Recommended

1. Correct invalid current page after dataset shrink.
2. Verify responsive behavior.
3. Add focused pagination tests.

## P2 — Future improvement

Extract a shared `Pagination.jsx` only after the regression fix is verified.

---

# 35. Final Instruction to Implementation Agent

Use the existing working Students pagination as the canonical reference.

Do not invent a new pattern.

Do not rewrite the page.

Do not change backend pagination.

Do not touch unrelated class functionality.

Make the smallest targeted change necessary to restore the intended pagination experience.

> **A pagination fix must remain a pagination fix.**
