# SisMD Redesign — Design Document

**Date:** 2026-02-23
**Status:** Approved

---

## 1. Overview

A full UI/UX refactor of the SisMD school sports-day timing app. The goal is to remove clutter, streamline the registration flow, replace Claude AI with Gemini Flash 3 for BIB scanning, and centralise sensitive configuration behind an admin login.

---

## 2. Navigation & Layout

- Default/landing tab: **Semak** (currently Daftar)
- Tab order: **Semak | Daftar | Keputusan**
- Header "SisMD" text is a clickable trigger → opens the Admin Login modal
- No API key or Google Sheets URL bars visible to regular users

---

## 3. Daftar Tab — Registration Flow

### Step 1 — School Info (once per session)
- Input: **KOD SEKOLAH** — auto-uppercase on input (e.g. `pbb1013` → `PBB1013`)
- Input: **NAMA SEKOLAH** — auto-uppercase on input
- These two fields persist for the whole session; user does not re-enter per student

### Step 2 — Category Selection
- Buttons: **L12** | **P12**
- Selecting a category shows the student entry form below

### Step 3 — Per-student Entry (repeating)
- Input: **NAMA** (full name)
- Input: **NO. IC** (12 digits; numeric keyboard on mobile)
  - Validation: exactly 12 digits
  - Last digit odd → gender = Lelaki (L12); last digit even → gender = Perempuan (P12)
  - Mismatch between selected category and IC gender → warn user, allow override
- On submit:
  - `jana()` assigns series number (L12xxxx / P12xxxx)
  - Student added to Firebase `murid` node
  - Form resets (NAMA + IC cleared; school info + category stay)
  - Success feedback (toast or inline)

### BIB Print
- Each registered student has a printable BIB card
- Card contents: **BIB number** (large, prominent) + **student name** (small, below)
- No school name on card
- Print layout: 4 cards per A4, `@media print` CSS, black-and-white friendly
- "Cetak BIB" button accessible per student or as bulk action

---

## 4. Semak (Scan) Tab

### Gemini Flash 3 Integration
- Replaces Claude AI
- API key loaded from Firebase `/config/geminiKey` at app init
- No API key input bar shown in normal UI

### Two-Step Verification Flow
1. Camera capture → image sent to Gemini Flash 3 → returns BIB number
2. App looks up student name from `murid` by BIB number
3. Display: `"L002 — ZAFRAN"` (number + name) for human confirmation
4. Operator taps **✅ Sahkan** → time recorded at that moment → `rekod` written to Firebase
5. If AI result is wrong, operator can type the correct BIB number manually before confirming

### Timer
- Larian L12 and P12 timers unchanged
- Time recorded = timestamp of Sahkan tap, relative to race start

---

## 5. Admin Panel

### Access
- Click **"SisMD"** header text → password modal
- Password: `admin123` (client-side check)
- On success: `md3_admin_exp` written to localStorage (24-hour expiry)
- If token is still valid on page load, admin mode is active without re-login

### Settings Layout — Accordion/Dropdown
All settings are hidden in collapsible sections (none expanded by default):

| Section | Contents |
|---|---|
| 🔑 Kunci API Gemini | Text input + Save; writes to Firebase `/config/geminiKey` |
| 📊 URL Google Sheets | Text input + Save; writes to Firebase `/config/gsUrl` |
| 🗑️ Reset Data | Confirmation button; wipes `murid`, `rekod`, `counters` from Firebase |

Sections are independent accordions — expanding one does not collapse others.

### Logout
- "Log Keluar Admin" link at bottom of panel closes the modal and clears the session token.

---

## 6. Data Storage

| Data | Storage |
|---|---|
| `murid` (participants) | Firebase RTDB only |
| `rekod` (results) | Firebase RTDB only |
| `larian` (race state) | Firebase RTDB only |
| `counters` (cL/cP) | Firebase RTDB + localStorage fallback |
| `geminiKey` | Firebase `/config/geminiKey` |
| `gsUrl` | Firebase `/config/gsUrl` |
| Admin session | localStorage (`md3_admin_exp`) only |

Dual-save (localStorage + Firebase) for `murid` and `rekod` is removed. localStorage is retained only for counters (offline fallback) and admin session.

---

## 7. Keputusan Tab

No structural changes. Leaderboard and export CSV remain.

---

## 8. Files Affected

| File | Change |
|---|---|
| `index.html` | New tab order; Daftar page restructured; Scan page simplified; admin modal added; BIB print section added |
| `src/modules/register.js` | Rewritten: school-first flow, IC gender detection, BIB print generation |
| `src/modules/scanner.js` | Rewritten: Gemini Flash 3, two-step confirm, no API bar |
| `src/modules/admin.js` | **New**: login modal, session management, Firebase `/config` read/write, reset |
| `src/store.js` | Remove `saveLocal()` for murid/rekod; add `/config` listener on init |
| `src/main.js` | Updated imports; load config from Firebase on init |

---

## 9. Approach

**Refactor (not full rewrite)** — Keep `firebase.js`, `utils.js`, and the existing CSS token system. Rewrite `register.js` and `scanner.js` from scratch. Add new `admin.js`. Preserve `jana()`, `toast()`, `fDur()`, and the Firebase RTDB listener pattern.
