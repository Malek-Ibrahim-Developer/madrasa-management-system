# 🏛️ Altus Kairos — Modular Madrasa Management ERP System
## 📖 Complete Project Documentation & Technical Overview (From Scratch to End)

---

## 📑 Index / Fihrist (فہرست)

1. [Project Ka Parichay (What is this Project?)](#1-project-ka-parichay-what-is-this-project)
2. [Humara Goal & Vision (Project Objectives)](#2-humara-goal--vision-project-objectives)
3. [Technology Stack (Konsi Technologies Use Hui Hain)](#3-technology-stack-konsi-technologies-use-hui-hain)
4. [Core Architecture & Authoritative Data Model](#4-core-architecture--authoritative-data-model)
5. [Kaam Kahan Tak Hua Hai? (Completed Work & Features)](#5-kaam-kahan-tak-hua-hai-completed-work--features)
6. [Kitna Kaam Baaki Hai? (Pending Work & Roadmap)](#6-kitna-kaam-baaki-hai-pending-work--roadmap)
7. [Project Folder & File Structure](#7-project-folder--file-structure)
8. [Next Immediate Steps (Agla Kadam)](#8-next-immediate-steps-agla-kadam)

---

## 1. Project Ka Parichay (What is this Project?)

**Altus Kairos (الْتُس كَايرُوس)** ek modern, modular, aur enterprise-grade **Madrasa Management ERP (Enterprise Resource Planning) System** hai.

### ❓ Ye Project Kis Bare Me Hai?
Hindustan aur aalmi satah par chalne wale Islami Madaris (Islamic Seminaries / Darul Uloom / Makatib) me aam taur par records, dakhla (admissions), haziri (attendance), imtehanat (exams), fees, mutabaq (kitchen ration), darul iqama (hostel), aur kutub-khana (library) ka kaam ya to **manual registers / paper files** par hota hai, ya bohot purane aur bikhre hue systems par hota hai jisme:
- Data gum hone ka khatra rehta hai.
- Ek saal se dusre saal dakhla ya promotion track karna mushkil hota hai.
- Talba (students) ki haziri aur taaleemi taraqqi ka fori jaiza nahi mil pata.
- Malyaati hisab-kitab (Zakat, Sadqah, Imdaad, Fees) me ghalatiyon ki gunjaish hoti hai.

**Altus Kairos** in tamam dushwariyon ko hal karke ek **single unified cloud-connected digital platform** provide karta hai jo:
- Tez (fast & snappy) hai.
- Mobile aur Desktop dono par seamless chalta hai.
- Strict database integrity aur relational rules follow karta hai.
- Ek khubsurat, modern Islamic aesthetic (Emerald Green `#009884` & Teal design system) ke sath design kiya gaya hai.

---

## 2. Humara Goal & Vision (Project Objectives)

### 🎯 Main Goals:
1. **Paperless Madrasa Administration**:
   Register aur paper-based system ko digital, searchable, aur exportable banana (Excel, PDF).
2. **Authoritative Academic Hierarchy**:
   Academic relationships ka ek pakka nizam tayyar karna:
   $$\text{AcademicYear} \longrightarrow \text{Class} \longrightarrow \text{ACTIVE Enrollment} \longrightarrow \text{Student} \longrightarrow \text{Attendance / Exams}$$
   Student ka class se talluq sidha kisi temporary field se na ho, balki **Enrollment** ke zariye authoritative ho taaki talib-e-ilm ki transfer, promotion aur tareekh (history) mehfooz rahe.
3. **Multi-Department Modular ERP**:
   Ek hi software ke andar Madrasa ke tamam shobajat (departments) shamil karna:
   - **Shoba-e-Taaleemat (Academics & Classes)**
   - **Shoba-e-Dakhila (Admissions & Students)**
   - **Shoba-e-Haziri (Daily & Monthly Attendance)**
   - **Shoba-e-Imtehanat (Exams & Grade Cards / Kashf-ul-Darajaat)**
   - **Shoba-e-Hisab (Accounts, Hadiya, Zakat, Sadqah, Staff Salary)**
   - **Shoba-e-Matbakh (Kitchen, Ration & Mess)**
   - **Shoba-e-Dar-ul-Iqama (Hostel & Dormitory)**
   - **Maktaba (Library & Book Circulation)**
4. **Zero Data Corruption & Concurrency Safety**:
   Agar do log ek hi waqt par class me dakhla le rahe hon ya attendance mark kar rahe hon, to database lock aur transactional integrity se capacity aur duplicate enrollment protect ho.
5. **Ultra-Responsive UI/UX**:
   Mudarris (teachers) aur Staff apne mobile phone par bhi asaani se haziri laga sakein aur table scroll karne me pareshani na ho.

---

## 3. Technology Stack (Konsi Technologies Use Hui Hain)

Humne project ko lightweight, ultra-fast aur enterprise-grade modern tech stack par tayyar kiya hai:

### 🌐 Frontend (Client Layer):
| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | `^19.2` | Modern UI components, hooks (`useState`, `useEffect`, `useCallback`, `useRef`, `useSearchParams`) |
| **Vite** | `^8.1` | Lightning-fast module bundler & dev server (Production build under 350ms) |
| **React Router DOM** | `^7.18` | Client-side routing, nested layouts, URL query state synchronization |
| **Recharts** | `^3.9` | Interactive data visualizations (Attendance trends, Financial income vs expense charts) |
| **React Hot Toast** | `^2.6` | Smooth, animated alert & feedback toast notifications |
| **React Icons** | `^5.7` | Standard Material Design (`react-icons/md`) iconography |
| **Vanilla CSS / Custom Properties** | Native | Custom ERP Design System (`variables.css`, `globals.css`) — Zero third-party bloated CSS frameworks |

### ⚙️ Backend (Server Layer):
| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | `>= 20.x` | High-concurrency JavaScript runtime environment |
| **Express.js** | `^5.2` | Robust RESTful API framework, modular routes, centralized middleware |
| **Prisma ORM** | `^5.22` | Type-safe database client, schema modeling, atomic transactions (`$transaction`) |
| **PostgreSQL (Supabase)** | Cloud | Cloud-hosted relational database with foreign keys, indexes, and ACID compliance |
| **ExcelJS** | `^4.4` | Server-side Excel generation & parsing for bulk student import/export |
| **csv-parse** | `^7.0` | High-performance CSV import parser |
| **PDFKit** | `^0.19` | Dynamic PDF document generation for student lists & reports |
| **Multer** | `^2.2` | Multipart form-data parser for file uploads |
| **dotenv** | `^17.4` | Environment variable security |

### 🛠️ Tooling & Infrastructure:
- **Localtunnel / Cloudflare Tunnel**: Public secure URL generation for testing on mobile and remote devices without cloud deployment.
- **Oxlint**: Ultra-fast Rust-based linter for code health.

---

## 4. Core Architecture & Authoritative Data Model

Madrasa me dakhla aur attendance aam school se mukhtalif hota hai (hifz sessions, saalana dakhle, darjaat ki tabdeeli). Isliye humne **Authoritative Enrollment Architecture** banaya hai:

```
┌──────────────────────────────────────────────────────────┐
│                   ACADEMIC YEAR                          │
│               (e.g., 2025-2026, isCurrent: true)         │
└────────────────────────────┬─────────────────────────────┘
                             │ 1 : N
                             ▼
┌──────────────────────────────────────────────────────────┐
│                       CLASS                              │
│              (e.g., Class 8, Hifz Year 1)                │
│              capacity: 40, status: ACTIVE                │
└────────────────────────────┬─────────────────────────────┘
                             │ 1 : N
                             ▼
┌──────────────────────────────────────────────────────────┐
│                    ENROLLMENT                            │
│           Authoritative Membership Authority            │
│       status: ACTIVE / TRANSFERRED / WITHDRAWN          │
│       enrollmentDate: DateTime, exitDate: DateTime       │
└──────────────┬────────────────────────────┬──────────────┘
               │ N : 1                      │ 1 : N (Target)
               ▼                            ▼
┌──────────────────────────────┐ ┌─────────────────────────┐
│           STUDENT            │ │       ATTENDANCE        │
│    Personal, Guardian, and   │ │ Daily attendance tied   │
│      Custom Field Values     │ │ to Student, Class, &    │
│  (Student.classId = legacy)  │ │ Date (status: PRESENT)  │
└──────────────────────────────┘ └─────────────────────────┘
```

### Database Models (`server/prisma/schema.prisma`):
1. **`AcademicYear`**: Saalana taaleemi saal track karta hai (`name`, `startDate`, `endDate`, `isCurrent`).
2. **`Class`**: Darja ya Jamat (`name`, `section`, `code`, `capacity`, `academicYearId`).
3. **`Enrollment`**: Student ka jamat se talluq. Kab dakhla hua, kab transfer hua, kab withdraw hua.
4. **`Student`**: Talib-e-ilm ka mukammal bayana (Admission No, Name, Walid ka naam, Phone, DOB, Gender, Blood Group, Guardian details, wagera).
5. **`CustomField` & `CustomFieldValue`**: Dynamic fields jo admin khud banata hai (Jaise: Aadhaar No, Hifz Para, Purana Madrasa) bina database code badle.
6. **`Attendance`**: Rozana haziri record (`date`, `status: PRESENT/ABSENT/LATE/EXCUSED`, `remarks`, `studentId`, `classId`).
7. **`Teacher` & `ClassTeacher`**: Asatiza (Teachers) aur unke classes ka talluq.
8. **`Subject` & `ClassSubject`**: Mazameen (Subjects) aur unka jamat ke sath rabt.
9. **`Exam` & `Result`**: Imtehanat aur unke marks/grades.
10. **`AuditLog`**: System compliance aur changes ka record.

---

## 5. Kaam Kahan Tak Hua Hai? (Completed Work & Features)

Abhi tak humne project ke 4 ahem pillars ko **100% production-ready** mukammal kar diya hai:

### ✅ 1. Dashboard Module (`/`)
- **Top Metric Cards**: Total Students, Total Staff, Bank Balance, Cash Balance, Today's Attendance percentage.
- **Charts & Visualizations**:
  - Weekly Attendance Area Chart (Recharts emerald gradient).
  - Monthly Finance Bar Chart (Income vs Expense comparison).
- **Recent Activity Feed**: Dakhila, payments, fees, notice alerts with relative timestamps.
- **Quick Action Buttons**: Fori student add karna, haziri lagana, payment note karna.
- **Department Summaries**: Kitchen menu of the day, Library books overdue, Hostel room occupancy.

### ✅ 2. Student Management Module (`/students`) — [Ultra Hardened]
- **Server-Side Pagination**:
  - Database level `skip` aur `take: pageSize` (10, 25, 50, 100).
  - Deterministic sort fallback (`orderBy: [primarySort, { id: 'asc' }]`) taaki pagination me record repeat ya gayab na ho.
- **Server-Side Debounced Search**:
  - 300ms debounce input — jaise hi user type karta hai stale request `AbortController` se cancel ho jati hai.
  - Search fields: Name, Admission No, Walid ka naam, Guardian, Phone.
- **Authoritative Filtering & URL Query Sync**:
  - Jamat (Class) ka filter active Enrollment ke zariye.
  - Status, Gender (Male, Female), Blood Group, Admission Date Range filter.
  - Sare filters browser URL me synchronize rehte hain (`useSearchParams`).
  - Removable filter chips aur "Clear All" button.
- **Mobile Filter Drawer Sheet**:
  - Mobile screens par full-screen responsive slide-over drawer filters ke liye.
- **Dual Responsive Layout**:
  - **Desktop View (>= 768px)**: Rich data table with avatar initials, status badges, sortable headers.
  - **Mobile View (< 768px)**: Clean **Student Cards** (`.student-cards-mobile`) jisme har talib-e-ilm ka card, details grid aur action buttons (View, Edit, Delete) mobile friendly hain.
- **Add / Edit Student Modal (Flex Scrolling Architecture)**:
  - Fixed header, horizontal scrolling tabs, isolated vertically scrollable form body (`max-height: calc(100dvh - 32px)` / mobile `100dvh`), aur fixed footer.
  - Screen se bahar nahi jata aur double-scrollbar create nahi karta.
- **Data Export & Import**:
  - Excel (`.xlsx`) aur CSV me export.
  - Template download aur bulk students Excel import validation ke sath.

### ✅ 3. Dynamic Custom Fields Manager (`/students/custom-fields`)
- Admin apni zaroorat ke hisab se student form me naye fields add kar sakta hai.
- Types: Text, Number, Date, Select (Dropdown), Checkbox, Textarea.
- Form me dynamically inject hote hain aur student profile me display hote hain.

### ✅ 4. Courses & Classes Module (`/courses`)
- Jamat (Classes) create karna, update karna, status toggle (`ACTIVE`, `DRAFT`, `CLOSED`, `ARCHIVED`).
- Academic year ke sath mapping.
- Row-level lock (`SELECT ... FOR UPDATE`) taaki concurrent requests me class ki capacity limit cross na ho sake.

### ✅ 5. Backend Robustness & Database Safeguards:
- Clean server startup: DDL startup script se hata diya gaya.
- Centralized `AppError` class aur HTTP error status codes (400, 404, 409, 422).
- Zero duplicate active enrollments verified in database.

---

## 6. Kitna Kaam Baaki Hai? (Pending Work & Roadmap)

Neeche un shobon ki tafseel hai jinpar kaam hona baaki hai ya next phases me scheduled hain:

### ⏳ Phase 1: Attendance Module Hardening (Next Immediate Task)
Halaanki basic attendance page aur backend mojood hai, lekin hamare technical audit ke mutabiq isme zaroori updates baaki hain:
- [ ] **Enrollment-Authoritative Attendance**: Attendance record ko `enrollmentId` se link karna taaki agar talib-e-ilm class transfer kare to purani haziri kharab na ho.
- [ ] **Safe Attendance Marking**: Backend par check lagana ki jis student ki haziri lag rahi hai, kya wo us din waqai us jamat me dakhil tha?
- [ ] **Un-mark / Clear Attendance Support**: Agar ghalti se haziri lag gayi ho to use wapas 'Unmarked' karne par backend row delete hona.
- [ ] **Weighted Monthly Statistics**: Mahana attendance ka hisab sahi formula se nikalna (attended student-days / eligible student-days).
- [ ] **ERP Design System Alignment**: Indigo color hata kar ERP Emerald Green (`#009884`) theme lagana aur mobile cards view integrate karna.

### ⏳ Phase 2: Shoba-e-Imtehanat (Exams & Results — `/exams`)
- [ ] Imtehanat schedule karna (Shashmahi, Saalanah, Monthly test, Hifz Evaluation).
- [ ] Numbers / Marks entry portal (Subject-wise, Total marks, Passing marks).
- [ ] Automated Grading (Mumtaz, Jayyid Jiddan, Jayyid, Maqbool, Rasib).
- [ ] **Kashf-ul-Darajaat (Report Card)** ka automated PDF generation jo print kiya ja sake.

### ⏳ Phase 3: Shoba-e-Maal (Fees & Financial Accounts — `/fees` & `/accounts`)
- [ ] Mahana Hadiya / Tuition fee structure aur chhoot (concessions/scholarships).
- [ ] Fee voucher generation aur online/cash payment receipts.
- [ ] Baqayaat (Pending fees) ki automatic list aur alerts.
- [ ] Zakat, Sadqah aur Imdaad ka alag alag khata (segregated funds ledger).
- [ ] Roznamcha (Daily Cashbook) aur Monthly Income vs Expense Statement.

### ⏳ Phase 4: Shoba-e-Mawaza (Staff & Teachers Salary — `/salary`)
- [ ] Asatiza aur mulaqeen (staff) ka monthly mashahara (salary).
- [ ] Deductions, advance payment, aur payment vouchers.

### ⏳ Phase 5: Shoba-e-Matbakh (Kitchen & Mess — `/kitchen`)
- [ ] Rozana ka khana (Daily Menu) display aur update.
- [ ] Rashan (groceries) ka stock inventory (Gehun, Chawal, Dal, Tel, Masale).
- [ ] Daily/Monthly kharche ka hisab.

### ⏳ Phase 6: Shoba-e-Dar-ul-Iqama (Hostel & Dormitory — `/hostel`)
- [ ] Kamron (Rooms) aur Chaarpai/Bed ka allocation.
- [ ] Muqeem talba (Hostel boarders) ki alag list aur nigrani.
- [ ] Hostel attendance aur chhutti (Leave gate pass) system.

### ⏳ Phase 7: Shoba-e-Kutub Khana (Library / Maktaba — `/library`)
- [ ] Kitabon ka record (Title, Musannif/Author, Jild, Publisher, Almirah No).
- [ ] Kitab jari karna (Issue) aur wapsi (Return) tracking.
- [ ] Daur-e-Hadith aur aam darjaat ke darsi nisaab ki kitabein (Darsi books distribution).

### ⏳ Phase 8: System Settings & Role-Based Access Control (RBAC — `/settings`)
- [ ] Deep User Authentication: Muhtamim (Admin), Nazim-e-Taleemat (Principal), Mudarris (Teacher), Muhasib (Accountant).
- [ ] Har user ko sirf uske shobe ki access dena (e.g. Teacher fees nahi dekh sakta, Accountant marks nahi badal sakta).
- [ ] Madrasa profile: Naam, Pata, Logo, aur Letterhead settings.

---

## 7. Project Folder & File Structure

```text
madrasa management system/
└── altus-kairos/
    ├── package.json                      # Frontend dependencies & Vite scripts
    ├── vite.config.js                    # Vite configuration
    ├── index.html                        # Single Page Application HTML shell
    │
    ├── public/                           # Static assets, icons, logos
    │
    ├── src/                              # React Frontend Source
    │   ├── main.jsx                      # React entry point
    │   ├── App.jsx                       # Master router & layout mapping
    │   ├── contexts/                     # Auth & App React Contexts
    │   ├── services/
    │   │   └── api.js                    # Centralized API fetcher with AbortController
    │   ├── components/
    │   │   ├── common/                   # Reusable UI elements
    │   │   ├── dashboard/                # Dashboard charts, cards, widgets
    │   │   ├── layout/                   # Sidebar, TopBar, MainLayout shell
    │   │   └── students/                 # ImportModal, CustomFieldsModal
    │   ├── pages/
    │   │   ├── Dashboard.jsx             # Main ERP overview & analytics
    │   │   ├── Students.jsx              # Complete Student Management UI
    │   │   ├── StudentProfile.jsx        # Detailed student view
    │   │   ├── CustomFieldsManager.jsx   # Dynamic field builder
    │   │   ├── Courses.jsx               # Class & curriculum management
    │   │   ├── Attendance.jsx            # Daily & monthly attendance UI
    │   │   ├── Login.jsx                 # Glassmorphic authentication page
    │   │   └── NotFound.jsx              # 404 error page
    │   └── styles/
    │       ├── variables.css             # Design system CSS tokens (Emerald/Teal)
    │       ├── globals.css               # Base typography, resets, animations
    │       ├── layout.css                # Sidebar, header, navigation CSS
    │       ├── dashboard.css             # Dashboard responsive grid styles
    │       ├── students.css              # Student table, mobile cards, modal CSS
    │       ├── courses.css               # Courses & classes page styling
    │       ├── attendance.css            # Attendance module styling
    │       └── custom-fields.css         # Custom fields UI styling
    │
    └── server/                           # Node.js & Express Backend
        ├── package.json                  # Backend dependencies & Prisma scripts
        ├── index.js                      # Express API server entry point (Port 5000)
        ├── .env                          # Database credentials (DATABASE_URL)
        ├── prisma/
        │   └── schema.prisma             # Master PostgreSQL relational data schema
        └── src/
            ├── middleware/
            │   └── errorHandler.js       # Centralized error handler
            ├── utils/
            │   └── AppError.js           # Standardized application error class
            └── routes/
                ├── studentRoutes.js      # Student CRUD, server-side pagination, search
                ├── classRoutes.js        # Class management & capacity row locking
                ├── attendanceRoutes.js   # Daily attendance & monthly stats API
                ├── customFieldRoutes.js  # Dynamic custom field endpoints
                ├── exportRoutes.js       # Excel & PDF student export
                └── importRoutes.js       # Bulk CSV/Excel student import
```

---

## 8. Next Immediate Steps (Agla Kadam)

Agle marhale (next step) me hum:
1. **Attendance Module Hardening**: `attendance_authoritative_architecture_implementation.md` specification ke mutabiq Attendance module me `enrollmentId` relation aur data backfill mukammal karenge.
2. **Attendance Mobile & UI Overhaul**: Attendance page ko ERP Design System (Emerald Green `#009884`) aur responsive student cards ke sath polish karenge.
3. **Exams / Results Module**: Iske baad Imtehanat (Exams) aur Kashf-ul-Darajaat (Report Cards) par kaam shuru hoga.

---

*Document Created: 2026-09-11*  
*Project: Altus Kairos — Modular Madrasa Management ERP System*  
*Lead Architect: Antigravity AI Engine & Pair Programming Team*
