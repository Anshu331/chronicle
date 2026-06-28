# Chronicle

**Local-first collaborative document editor** with offline sync, deterministic conflict resolution, version history, role-based access, and AI assistance.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Run Locally](#run-locally)
- [Environment Variables](#environment-variables)
- [Using the App](#using-the-app)
- [API Routes](#api-routes)
- [Project Structure](#project-structure)
- [Scripts](#scripts)


---

## Features

| Feature | Details |
|---------|---------|
| **Local-first editing** | Documents load from IndexedDB first; sync runs in the background |
| **Offline support** | Edit offline; changes queue and sync when back online |
| **Conflict resolution** | Vector clocks + operational transform + genesis rebuild from op log |
| **Version history** | Snapshots with timeline; restore without overwriting collaborators |
| **Collaborators** | Invite by email — Owner, Editor (edit/sync), Viewer (read-only) |
| **AI assistant** | Summarize, improve, expand, change tone (Google Gemini) |
| **Auth & roles** | Auth.js JWT sessions; permission checks on every API route |
| **Mobile responsive** | Works on phone, tablet, and desktop |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4, Radix UI |
| Database | MongoDB Atlas + Mongoose |
| Auth | Auth.js (NextAuth v5), bcrypt |
| Local storage | IndexedDB (`idb`) |
| AI | Google Generative AI (`gemini-2.5-flash`) |
| Validation | Zod |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (Client)                      │
│  ┌──────────────┐   ┌──────────────┐   ┌───────────────────┐  │
│  │  React UI    │──▶│  IndexedDB   │◀──│  Sync Engine      │  │
│  │  Editor      │   │  (Source of  │   │  (Queue + Retry)  │  │
│  │              │   │   Truth)     │   │                   │  │
│  └──────────────┘   └──────────────┘   └─────────┬─────────┘  │
│         │                    ▲                     │ online     │
│         ▼                    │ merge              ▼             │
│  ┌──────────────┐   ┌────────┴─────┐   ┌───────────────────┐  │
│  │  CRDT Ops    │──▶│ Vector Clock │◀──│  Fetch /api/sync  │  │
│  │  (diff/apply)│   │  Merge       │   │                   │  │
│  └──────────────┘   └──────────────┘   └─────────┬─────────┘  │
└──────────────────────────────────────────────────┼─────────────┘
                                                   │
┌──────────────────────────────────────────────────┼─────────────┐
│                     Next.js 16 Server            ▼             │
│  ┌──────────┐  ┌────────────┐  ┌────────────────────────────┐  │
│  │ Auth.js  │  │ Zod Valid. │  │  MongoDB (Documents, Ops,  │  │
│  │ JWT      │  │ Size caps  │  │  Versions, Users)          │  │
│  └──────────┘  └────────────┘  └────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Single-folder full-stack layout:** UI pages live under `src/app/` and API routes under `src/app/api/` in the same project.

---

## Prerequisites

- **Node.js 20+** — [nodejs.org](https://nodejs.org)
- **npm** (comes with Node.js)
- **MongoDB Atlas** account — [mongodb.com/atlas](https://www.mongodb.com/atlas) (free tier works)
- **Google AI API key** (optional) — for live AI features — [aistudio.google.com](https://aistudio.google.com)

---

## Run Locally

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/chronicle.git
cd chronicle
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create environment file

**macOS / Linux:**

```bash
cp .env.example .env.local
```

**Windows (PowerShell / CMD):**

```powershell
copy .env.example .env.local
```

### 4. Configure `.env.local`

Open `.env.local` and set at minimum:

```env
AUTH_SECRET=your-random-secret-at-least-32-chars
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster.mongodb.net/chronicle?retryWrites=true&w=majority
AUTH_URL=http://localhost:3000
```

**Generate `AUTH_SECRET`:**

```bash
# macOS / Linux
openssl rand -base64 32
```

```powershell
# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

**MongoDB Atlas setup:**

1. Create a free cluster
2. Create a database user (username + password)
3. Under **Network Access**, add your IP (or `0.0.0.0/0` for development)
4. Copy the connection string and replace `USER`, `PASSWORD`, and database name

### 5. Start the development server

```bash
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### 6. Create an account

1. Go to **Register** and sign up
2. Log in
3. Click **New Document** on the dashboard
4. Start writing — changes save locally and sync when online

### 7. Production build (optional — verify before deploy)

```bash
npm run build
npm start
```

App runs at [http://localhost:3000](http://localhost:3000) in production mode.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_SECRET` | Yes | Secret for signing JWT sessions |
| `MONGODB_URI` | Yes | MongoDB Atlas connection string |
| `AUTH_URL` | Yes (prod) | Full app URL — `http://localhost:3000` locally, your Vercel URL in production |
| `GEMINI_API_KEY` | No | Google Gemini API key — AI panel needs this for live responses |
| `GEMINI_MODEL` | No | Model name (default: `gemini-2.5-flash`) |

> Never commit `.env.local` or real secrets to GitHub. Only `.env.example` belongs in the repo.

---

## Using the App

### Dashboard

- **New Document** — creates a document and opens the editor
- Document cards show title, preview, and your role

### Editor

| Action | How |
|--------|-----|
| Rename document | Click the title at the top and type |
| Edit content | Type in the main text area |
| Save snapshot | Toolbar → **Snapshot** |
| Version history | Toolbar → **History** |
| AI tools | Toolbar → **AI** (Owner/Editor only) |
| Collaborators | Toolbar → **Members** |

### Roles

| Role | Permissions |
|------|-------------|
| **Owner** | Edit, sync, invite members, change roles, remove members |
| **Editor** | Edit content and sync changes |
| **Viewer** | Read-only — cannot edit or push sync updates |

### Inviting collaborators

1. Open **Members** in the editor (owner only)
2. Enter the colleague's email (they must already have a Chronicle account)
3. Choose **Editor** or **Viewer**
4. Click **Add Member**

### Offline mode

- Open a document once while online to cache it locally
- Edit offline — changes queue in IndexedDB
- When back online, the sync engine flushes automatically

---

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/auth/register` | Create account |
| `*` | `/api/auth/[...nextauth]` | Login / session |
| `GET` / `POST` | `/api/documents` | List / create documents |
| `GET` / `PATCH` / `DELETE` | `/api/documents/[id]` | Read / update title / delete |
| `POST` | `/api/documents/[id]/sync` | Push & pull CRDT operations |
| `GET` / `POST` / `PUT` | `/api/documents/[id]/versions` | Version history & restore |
| `GET` / `POST` / `PATCH` / `DELETE` | `/api/documents/[id]/members` | Collaborators |
| `POST` | `/api/ai` | AI summarize / improve / expand / tone |

---

## Project Structure

```
chronicle/
├── public/                 # Static assets
├── src/
│   ├── app/
│   │   ├── api/            # Backend API routes
│   │   ├── dashboard/      # Document list page
│   │   ├── docs/[id]/      # Editor page
│   │   ├── login/          # Auth pages
│   │   └── register/
│   ├── components/
│   │   ├── editor/         # Editor, AI, history, members
│   │   ├── dashboard/      # Dashboard UI
│   │   ├── sync/           # Sync status indicator
│   │   └── ui/             # Shared UI primitives
│   ├── lib/
│   │   ├── auth/           # Auth.js + permissions
│   │   ├── crdt/           # Vector clocks, OT, merge
│   │   ├── db/             # MongoDB models
│   │   ├── local/          # IndexedDB + sync engine
│   │   ├── ai/             # Gemini prompts
│   │   └── validation/     # Zod schemas
│   └── types/              # Shared TypeScript types
├── .env.example            # Environment template (safe to commit)
├── SECURITY.md             # Threat model & mitigations
└── package.json
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (hot reload) |
| `npm run build` | Create production build |
| `npm start` | Run production server (after build) |
| `npm run lint` | Run ESLint |

---

## Author

**Anshu Kumar Bishwas**

- GitHub: [github.com/Anshu331](https://github.com/Anshu331)
- LinkedIn: [linkedin.com/in/anshu-kumar-bishwas-792801207](https://linkedin.com/in/anshu-kumar-bishwas-792801207/)

---


