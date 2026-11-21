---
title: IPL 2027 Live Auction Arena
emoji: 🏏
colorFrom: yellow
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# 🏏 IPL 2027 Live Multiplayer Auction Platform

A production-grade, real-time multiplayer IPL 2027 Mini-Auction arena built with **Next.js 16 (App Router)**, **TypeScript**, **Tailwind CSS**, **Socket.io**, **Zustand**, **Prisma ORM (PostgreSQL)**, and **LiveKit WebRTC**.

## 🚀 Key Features

1. **IPL 2027 Mini-Auction Regulations**:
   - Total Team Purse: **₹130.00 Cr** (₹125 Cr baseline + ₹5 Cr performance cap).
   - Squad Size Cap: **25 players** maximum.
   - Overseas Player Cap: **8 overseas** maximum.
   - Pre-configured 2027 Mini-Auction Remaining Purses (LSG: 47.45 Cr, KKR: 41.65 Cr, SRH: 40.15 Cr, DC: 39.50 Cr, MI: 32.60 Cr, CSK: 28.05 Cr, RR: 27.05 Cr, PBKS: 18.60 Cr, RCB: 14.15 Cr, GT: 8.75 Cr).
   - Dynamic bid increments (+5L, +10L, +20L, +25L) with server-side mutex locking.

2. **100% Excel-Driven Data Ingestion**:
   - Ingest custom spreadsheets via `.xlsx`, `.xls`, `.csv`, or `.txt`.
   - **Master All-In-One Workbook**: Ingests `TeamPurses`, `RetainedSquads`, and `AuctionPool` in a single click.
   - Separate upload buttons for `Upload Retained Squads` and `Upload Auction Pool`.
   - Instant download of `IPL_2027_Mini_Auction_Template.xlsx` directly from the UI.

3. **Multiplayer & Solo Testing Mode**:
   - Host / Auctioneer can start immediately with 0 teams for solo test simulations.
   - Late-joining players can claim open franchises or join mid-auction.
   - Real-time Franchise Bidding Simulator allows the Auctioneer to test bid flows across all 10 franchises without other clients.

4. **Dedicated All Squads Showcase Page (`/room/[code]/squads`)**:
   - Live roster viewer with franchise tabs, role filters, retained vs bought filters, and player jersey avatars.
   - Integrated with PostgreSQL database and in-memory real-time sync.

5. **Hugging Face Spaces & Docker Ready**:
   - Binds dynamically to `process.env.PORT || 7860` on `0.0.0.0`.
   - Wildcard CORS and dual transports (`websocket`, `polling`) for reverse-proxy resilience.

## 🛠️ Environment Variables

Create a `.env.local` or `.env` file:

```env
# Server Port (Hugging Face Spaces defaults to 7860)
PORT=7860

# PostgreSQL Database Connection (Optional - falls back cleanly to memory if unset)
DATABASE_URL="postgresql://user:password@host:5432/ipl_auction?schema=public"

# LiveKit WebRTC Voice Rooms (Optional - falls back to audio simulation)
LIVEKIT_API_KEY="your-livekit-api-key"
LIVEKIT_API_SECRET="your-livekit-api-secret"
NEXT_PUBLIC_LIVEKIT_URL="wss://your-project.livekit.cloud"
```

## 📦 Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma Client
npx prisma generate

# 3. Start development server
npm run dev

# 4. Or build & run production server
npm run build
npm start
```

Navigate to `http://localhost:7860`.
