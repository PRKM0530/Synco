# Synco — Real-Time Activity Platform

Synco is a full-stack web application that lets users discover, create, and join real-world activities happening nearby. Think of it as a social meetup platform with real-time chat, trust scoring, map-based discovery, and safety features built in.

## Features

- **Activity Management** — Create, edit, join, and manage group activities with category tags, location pins, and participant limits
- **Map View** — Discover nearby activities on an interactive Google Maps interface with distance filtering
- **Real-Time Chat** — Group chat rooms for each activity + direct messages between friends, powered by Socket.IO
- **Trust Score System** — Users earn or lose trust points based on attendance verification, encouraging accountability
- **Attendance Verification** — QR-code based check-in system with host roster confirmation
- **Friend System** — Add friends, view their activities, and filter the feed by friends-only content
- **SOS Safety Feature** — Emergency signal broadcasting to nearby users with live map tracking
- **Notifications** — Real-time push notifications for join requests, approvals, friend requests, and SOS alerts
- **Admin Dashboard** — Moderation panel for managing reports, banning users, and platform oversight
- **Email Verification** — OTP-based email verification for account registration and password reset

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, React Router v7 |
| Styling | Vanilla CSS (custom design system) |
| Maps | Google Maps API, Leaflet |
| Backend | Node.js, Express 5 |
| Database | PostgreSQL with Prisma ORM |
| Real-Time | Socket.IO |
| Auth | JWT (JSON Web Tokens) |
| Email | Nodemailer (Gmail SMTP) |
| File Upload | Multer |

## Project Structure

```
Synco/
├── client/                 # React frontend (Vite)
│   ├── public/             # Static assets
│   └── src/
│       ├── components/     # Reusable UI components
│       │   ├── activity/   # ActivityCard, MapPicker
│       │   ├── chat/       # ChatRoom
│       │   ├── common/     # CategoryIcon, SyncoLogo
│       │   ├── layout/     # Navbar, BottomNav, FloatingActionButton
│       │   └── profile/    # OnboardingModal
│       ├── context/        # AuthContext (global auth state)
│       ├── pages/          # Route-level page components
│       │   ├── activity/   # Create, Edit, Detail, Verify, Roster
│       │   ├── admin/      # Admin Dashboard
│       │   ├── auth/       # Login, Register, OTP, Password Reset
│       │   ├── chat/       # Inbox, Direct Messages
│       │   ├── explore/    # Explore nearby activities
│       │   ├── friends/    # Friends list
│       │   ├── home/       # Home feed, Map view
│       │   ├── notifications/
│       │   └── profile/    # View & Edit profile
│       ├── services/       # API client (axios) & Socket.IO client
│       └── utils/          # Category helpers, map utilities
│
├── server/                 # Express backend
│   ├── config/             # DB connection, env config
│   ├── controllers/        # Route handlers (business logic)
│   ├── middleware/         # Auth, error handling, file upload
│   ├── prisma/             # Schema & migrations
│   ├── routes/             # Express route definitions
│   ├── uploads/            # User-uploaded files (gitignored)
│   └── utils/              # Email utility
│
└── .gitignore
```

## Getting Started

### Prerequisites

- **Node.js** v18 or higher
- **PostgreSQL** (local install or a cloud provider like Neon/Supabase)
- **Git**

### 1. Clone the Repository

```bash
git clone https://github.com/PRKM0530/Synco.git
cd Synco
```

### 2. Set Up the Backend

```bash
cd server
npm install
```

Create a `.env` file by copying the example:

```bash
cp .env.example .env
```

Fill in your values in `server/.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/synco"
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"
PORT=5000
CLIENT_URL="http://localhost:5173"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-gmail-app-password"
```

Push the database schema:

```bash
npx prisma db push
npx prisma generate
```

Start the dev server:

```bash
npm run dev
```

The API will be running at `http://localhost:5000`.

### 3. Set Up the Frontend

Open a new terminal:

```bash
cd client
npm install
```

Create a `.env` file:

```bash
cp .env.example .env
```

For local development, the default values work out of the box (Vite proxies API calls to the backend).

Start the dev server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Login and get JWT |
| `POST` | `/api/auth/verify-email` | Verify email with OTP |
| `GET` | `/api/activities` | List upcoming activities |
| `POST` | `/api/activities` | Create a new activity |
| `GET` | `/api/activities/:id` | Get activity details |
| `POST` | `/api/activities/:id/join` | Request to join |
| `GET` | `/api/chat/dms` | Get chat inbox |
| `GET` | `/api/friends` | Get friends list |
| `POST` | `/api/friends/:userId` | Add a friend |
| `GET` | `/api/notifications` | Get notifications |
| `POST` | `/api/sos` | Create SOS signal |
| `GET` | `/api/admin/stats` | Admin dashboard stats |

See `server/routes/` for the complete API reference.

## Database Schema

The PostgreSQL database is managed through Prisma. Key models:

- **User** — Profile, trust score, role (USER/ADMIN), verification status
- **Activity** — Title, location (lat/lng), category, visibility, status
- **ActivityMember** — Many-to-many join table with co-host support
- **JoinRequest** — Pending/Approved/Rejected join requests
- **ChatRoom & ChatMessage** — Activity group chat with pin/delete support
- **DirectMessage** — One-to-one messaging between users
- **FriendContact** — Unidirectional friend relationships
- **Notification** — In-app notifications with types (join, approval, SOS, etc.)
- **ActivityVerification** — Attendance confirmation with host feedback
- **TrustLog** — Audit trail for trust score changes
- **Report** — User reports with admin moderation
- **SosSignal** — Emergency signals with GPS coordinates

Run `npx prisma studio` to browse the database visually.

## Deployment

The project is configured for free-tier deployment:

| Component | Service |
|-----------|---------|
| Frontend | Netlify |
| Backend | Render |
| Database | Neon (free PostgreSQL) |

### Quick Deploy Steps

1. **Database** — Create a free PostgreSQL database on [neon.tech](https://neon.tech)
2. **Backend** — Deploy `server/` to [Render](https://render.com) as a Web Service
   - Build Command: `npm install && npx prisma generate && npx prisma db push`
   - Start Command: `node server.js`
3. **Frontend** — Deploy `client/` to [Netlify](https://netlify.com)
   - Build Command: `npm run build`
   - Publish Directory: `client/dist`
   - Set `VITE_API_URL` and `VITE_SOCKET_URL` to your Render URL

## Environment Variables

### Server (`server/.env`)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret key for signing tokens |
| `JWT_EXPIRES_IN` | Token expiry (e.g., `7d`) |
| `PORT` | Server port (default: 5000) |
| `CLIENT_URL` | Frontend URL for CORS |
| `SMTP_HOST` | Email server host |
| `SMTP_PORT` | Email server port |
| `SMTP_USER` | Email address |
| `SMTP_PASS` | Email app password |

### Client (`client/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API URL (leave empty for local dev) |
| `VITE_SOCKET_URL` | Socket.IO server URL (leave empty for local dev) |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps API key |

## Team

| Member | Role |
|--------|------|
| **Praveen (PRKM0530)** | Project Lead — Architecture, Auth, Core Backend |
| **Preshit (ArcNetic)** | Activity Pages — Create, Edit, Detail, Map Picker |
| **Umesh** | Chat System — Inbox, DMs, Real-Time Messaging, SOS |
| **Chirag** | Notifications — Backend Controller & UI |
| **Omprakash Saran** | Profile System — Profile Page, Edit Profile, Friends |
| **Aditya (ADITYA106K)** | Admin Panel — Dashboard, Reports, Moderation |

## License

This project is for educational purposes.
