# T7 Logistics Control Center

A professional demo application for quick-commerce logistics orchestration. This project simulates a logistics control center with multi-agent decision-making for store selection, inventory validation, dispatch assignment, route planning, and demand forecasting.

---

## Overview

`T7 Logistics Control Center` is a proof-of-concept logistics dashboard that combines:

- a React + Vite frontend user interface
- an Express backend API
- a simulated agent orchestration pipeline
- local mock data for orders, stores, riders, and demand

The app is designed to illustrate how modern logistics systems can coordinate multiple agents to fulfill orders efficiently and transparently.

---

## Key features

- Store selection agent: chooses the optimal fulfillment location
- Inventory agent: validates availability and fulfillment strategy
- Dispatch agent: assigns riders to orders
- Route agent: estimates delivery path and timing
- Demand agent: forecasts capacity needs and trends
- Real-time dashboard: displays orchestration timeline and execution details

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite |
| Backend | Node.js, Express |
| Data | Local mock dataset |
| AI / Orchestration | Ollama / OpenAI-compatible agent logic |
| Deployment | Vercel (frontend) / Render (full-stack) |

---

## Project structure

- `src/` — React application and UI components
- `src/agents/` — orchestration agents and simulation logic
- `server/` — Express API server
- `data/mockData.js` — sample logistics dataset
- `vite.config.js` — Vite development server config
- `vercel.json` — Vercel deployment configuration

---

## Prerequisites

Before you begin, ensure the following are installed:

- Node.js 18+ or later
- npm
- Optional: Ollama running locally to enable the agent runtime

---

## Installation

From the repository root:

```powershell
npm install
```

---

## Running locally

### Development mode

Start the backend API:

```powershell
npm run server
```

In a second terminal, start the frontend:

```powershell
npm run client
```

Open the application in your browser at:

```text
http://localhost:5173
```

The frontend proxies requests to the backend API at `http://localhost:3001`.

### Production-style mode

Build the frontend and run the production server:

```powershell
npm run build
npm start
```

The Express server will serve the built frontend from `dist/` when `NODE_ENV=production`.

---

## API Reference

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/health` | GET | Check backend status |
| `/api/bootstrap` | GET | Load initial bootstrap data |
| `/api/simulate` | POST | Run an order simulation |

### Example request

```json
{
  "orderId": "order_1"
}
```

---

## Deployment

### Deploying to Render (recommended full-stack)

1. Connect the repository to Render.
2. Configure the build command:

```powershell
npm install && npm run build
```

3. Configure the start command:

```powershell
npm start
```

4. Add the environment variable:

```text
NODE_ENV=production
```

Render will run the Node.js backend and serve the built frontend from `dist/`.

### Deploying to Vercel (frontend only)

1. Deploy the repo to Vercel.
2. Set the environment variable:

```text
VITE_API_BASE_URL=https://your-backend-url
```

Vercel will build the frontend and deploy it as a static site. API requests will be forwarded to the configured backend URL.

---

## Environment variables

The project supports AI runtime configuration via environment variables:

- `VITE_OLLAMA_BASE_URL` or `OLLAMA_BASE_URL`
- `VITE_OLLAMA_MODEL` or `OLLAMA_MODEL`
- `VITE_OPENAI_API_KEY` or `OPENAI_API_KEY`
- `VITE_OPENAI_BASE_URL` or `OPENAI_BASE_URL`
- `VITE_API_BASE_URL` — frontend API base URL for deployed environments

---

## Notes

- The simulation uses local mock data from `data/mockData.js`.
- If the UI cannot reach the backend, make sure the backend is running with `npm run server`.
- The app is designed for demo purposes and can be extended with a real data backend or production AI runtime.
