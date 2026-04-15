# T7 Logistics Control Center

Multi-agent dark-store orchestration demo for quick-commerce operations.

## Stack

- Backend: Node.js + Express
- Frontend: React + Vite
- AI runtime: local Ollama-backed agent orchestration

## Run locally

1. Install dependencies:

```powershell
npm install
```

2. Start the backend API:

```powershell
npm run server
```

3. In a second terminal, start the frontend:

```powershell
npm run client
```

4. Open the Vite app shown in the terminal, usually:

```text
http://localhost:5173
```

## API endpoints

- `GET /api/health`
- `GET /api/bootstrap`
- `POST /api/simulate`

## Notes

- Ollama must already be running locally.
- The current simulation uses the mock data in `data/mockData.js`.
- The dashboard lets you select an order scenario and inspect summary, timeline, and per-agent outputs.
