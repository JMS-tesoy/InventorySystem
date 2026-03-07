# InventorySystem

This project now supports a real SQLite database backend while preserving the existing localStorage data.

## How it works

- The UI remains local-first (no behavior break).
- On startup, `db.js` checks if backend is available.
- Migration logic is non-destructive:
  - If DB is empty and browser localStorage has data: local data is imported into DB.
  - If DB has data and browser localStorage is empty: DB data is loaded into localStorage.
  - If both DB and localStorage already have data: local data is kept unchanged.

## Run

1. Install dependencies:
   - `npm install`
2. Start server:
   - `npm start`
3. Open:
   - `http://localhost:3000`

## Files added

- `server.js` - Express API + static hosting
- `schema.sql` - SQLite schema
- `package.json` - backend dependencies and scripts

## Recent Updates

- Dark mode implementation unified and applied consistently across pages/components.
- Theme toggle refined (professional icon, instant switch behavior).
- Topbar controls aligned consistently across pages.
- Last visited page now persists per user after reload/login.
- Settings trash-bin actions hardened (reliable delete handling for all rows).
- Delete/confirm dialog replaced with an in-app themed modal (dark-mode aware), including logout confirmation.

