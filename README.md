# 📦 Supply Monitor - Office Inventory System

A lightweight, full-stack Office Supplies Inventory System featuring real-time team collaboration, role-based access control, advanced theming, and an offline-first architecture synchronized with a SQLite backend.

---

## ✨ Key Features

*   **Inventory Management**: Track stock balances, add new stock, and issue requests.
*   **Role-Based Access (RBAC)**: 
    *   **Admin**: Full access to add/edit items, manage employees/departments, and approve transactions.
    *   **User**: View-only mode for inventory and history, but full access to Team Chat.
*   **Real-Time Team Chat**: Powered by **Socket.IO**. Supports image attachments, emoji reactions, threaded replies, `@mentions`, `/commands`, and live "Online Users" presence tracking.
*   **Advanced Theming System**: 20 persistent color themes (Ocean, Forest, Crimson, etc.) that globally update CSS variables across the entire app.
*   **Local-First Database Sync**: The frontend operates instantly via `localStorage` and automatically syncs in the background to a Node.js Express / SQLite backend.
*   **Excel Export**: Full workbook generation (Inventory, Requests, Stock-in, Employees) using `SheetJS`.

---

## 🚀 Quick Start

### Prerequisites
*   **Node.js** (v14 or newer)
*   **npm** (Node Package Manager)

### Installation & Running

1. **Install dependencies**:
   ```bash
   npm install
   ```
   *(Installs Express, Socket.IO, and SQLite3)*

2. **Start the server**:
   ```bash
   node server.js
   ```
   *(Tip: Use `npm install -g nodemon` and run `nodemon server.js` for automatic restarts during development)*

3. **Access the App**:
   Open your browser and navigate to: **http://localhost:3000**

---

## 🔐 Default Test Accounts

The database automatically seeds these accounts on the first run:

| Role | Username | Password |
| :--- | :--- | :--- |
| **Admin** | `admin` | `Admin@1234` |
| **User** | `user` | `User@1234` |
| **User** | `alice` | `User@1234` |
| **User** | `bob` | `User@1234` |
| **User** | `charlie` | `User@1234` |

> *Note: Logging into different accounts via separate browsers/incognito windows is highly recommended to test the real-time chat and online presence features!*

---

## 📂 Project Structure

### Backend (Node.js)
*   `server.js` - The main Express server and Socket.IO WebSocket handler. Manages a 10MB payload limit for image attachments and exposes `/api/state` for background database syncing.
*   `schema.sql` - The SQLite schema definition. Creates tables for KV storage (app state), Accounts, and Chat History.
*   `data.sqlite3` - *(Auto-generated)* The local SQLite database file.

### Frontend (Vanilla JS / HTML / CSS)
*   `index.html` - The single-page application (SPA) wrapper. Contains the login overlay, sidebar navigation, and all hidden page templates (`.page` divs).
*   `styles.css` - Global stylesheet. Uses CSS variables heavily for the 20-variant theme engine and responsive UI breakpoints.
*   `app.js` - Core application logic. Handles navigation state, UI rendering (Dashboard, Settings, etc.), theme switching, and DOM events.
*   `auth.js` - Authentication controller. Handles login verification, session storage, account creation logic, and role-based UI toggling (`role-admin` vs `role-user`).
*   `db.js` - Local-First data layer. Wraps `localStorage` arrays and automatically pushes mutations back to the Express server using a background `initBackendSync()` pipeline.
*   `export.js` - Excel generation logic utilizing the external `SheetJS` library.

---

## 💬 Chat Architecture

The chat module operates in `index.html` (UI) and `server.js` (WebSockets). 

**Notable Chat Events (Socket.IO):**
*   `chat_message`: Broadcasts text, target mentions (`@ADMIN`), colors, replies, and Base64 image attachments.
*   `chat_reaction`: Broadcasts emoji clicks and maintains an active count array mapped to `msgId`.
*   `user_join` / `user_leave`: Emitted upon login/logout or socket disconnection to populate the right-hand **Online Users** panel.

All chat events are persisted to the `chat_history` SQLite table to survive server reloads.

---

## 🛠️ Development Tips

1. **Clearing Data**: If you want to start completely fresh, delete the `data.sqlite3` file and clear your browser's `localStorage` via DevTools. The app will automatically rebuild and reseed itself on the next load.
2. **Modifying Themes**: To add a new theme, append its color variables to the bottom of `styles.css`, and add its key to the dropdown array in `auth.js` (for the topbar) and `index.html` (for the pre-loader script).