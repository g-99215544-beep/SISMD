# SisMD Firebase Real-Time Sync Design

**Date:** 2026-02-23
**Status:** Approved
**Approach:** Option A — Firebase RTDB + localStorage as offline cache

## Problem

The app currently stores all data in `localStorage`, making it device-local only. Multiple operators at an event (finish line scanner, race controller, school lookup) cannot share data in real-time.

## Goal

Add Firebase Realtime Database sync so all open devices see the same race data instantly, while keeping the app fully functional offline (page refresh included).

## Architecture

### Two-layer persistence

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Primary (local) | `localStorage` | Instant reads/writes, survives offline + page refresh |
| Sync (remote) | Firebase RTDB | Real-time propagation to all connected devices |

Writes go to both layers. Reads come from localStorage (fast) on startup, then Firebase overwrites with latest snapshot before attaching live listeners.

### New file: `src/firebase.js`

Initialises the Firebase app and exports the `db` handle. Contains the hardcoded Firebase config (web SDK config is public by design — security is enforced by Firebase Security Rules, not by hiding the config).

```js
import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyAam8uHZivxN9wMos-AEPgb5UDPKkJV9Mc",
  authDomain: "sismd-9153f.firebaseapp.com",
  databaseURL: "https://sismd-9153f-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "sismd-9153f",
  storageBucket: "sismd-9153f.firebasestorage.app",
  messagingSenderId: "52136487791",
  appId: "1:52136487791:web:9cd966fad478ebd96fd69a",
  measurementId: "G-N0E4Z2WECV"
};

export const app = initializeApp(firebaseConfig);
export const db  = getDatabase(app);
```

### Firebase data structure

RTDB does not support arrays. Arrays are stored as keyed objects and converted on read.

```
/murid/    { <uuid>: { nombor, nama, ic, sekolah, kodSkl, kat, jantina } }
/rekod/    { <uuid>: { nombor, nama, sekolah, kodSkl, kat, mula, tamatMs, tempoh, rankKat } }
/larian/   { L12: { s, mula, tamat }, P12: { s, mula, tamat } }
/counters/ { cL: 0, cP: 0 }
```

### Write flow (`save()` in store.js)

1. Write to `localStorage` (synchronous, instant)
2. Call `syncToFirebase()` — fire-and-forget `set()` calls to RTDB (no `await` in hot paths like bib scan)

### Read/sync flow (`init()` in main.js)

1. `get(ref(db, '/'))` — fetch latest snapshot, hydrate state + localStorage
2. Attach `onValue()` listeners on `/murid`, `/rekod`, `/larian`, `/counters`
3. Each listener: convert object→array, update `state.*`, re-render affected views

### Credentials

- **Firebase config** — in `src/firebase.js`, committed to git (intentionally public)
- **Anthropic API key** — localStorage only, device-specific, never synced

### Firebase Security Rules

Set in Firebase Console → Realtime Database → Rules:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

Open rules are appropriate for an internal, trusted event-day tool.

## Impact on Existing Plan

The 10-task file-structure plan is unchanged except:

- **Task 3 (store.js):** `save()` gains a `syncToFirebase()` call; `load()` gains a Firebase snapshot fetch; new `initFirebaseListeners()` export added
- **New task (Task 3b):** Create `src/firebase.js` with Firebase init + `firebase` npm packages added to `package.json`
- **Task 9 (main.js):** `init()` calls `initFirebaseListeners()` after local state is loaded

All other tasks (register, timer, scanner, leaderboard) are unaffected — they only call `save()` and read from `state.*`.

## Out of Scope

- Authentication / access control
- Per-event namespacing (one database per race)
- Firestore migration
- Conflict resolution beyond last-write-wins
