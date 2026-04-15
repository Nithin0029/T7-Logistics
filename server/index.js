import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import { orchestrate } from "../src/agents/orchestrator.js";
import { stores, riders, sampleOrders, demandHistory } from "../data/mockData.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const staticPath = path.join(__dirname, "../dist");

const app = express();
const port = Number(process.env.PORT || 3001);

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "t7-logistics-control-center",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/bootstrap", (_req, res) => {
  res.json({
    orders: sampleOrders,
    stores,
    riders,
    demandHistory,
  });
});

app.post("/api/simulate", async (req, res) => {
  try {
    const requestedOrderId = req.body?.orderId;
    const requestedOrder = requestedOrderId
      ? sampleOrders.find((order) => order.id === requestedOrderId)
      : sampleOrders[0];

    if (!requestedOrder) {
      return res.status(404).json({
        ok: false,
        error: `Order not found: ${requestedOrderId}`,
      });
    }

    const agentStream = [];
    const result = await orchestrate(
      requestedOrder,
      stores,
      riders,
      demandHistory,
      (agent, status) => {
        agentStream.push({
          timestamp: Date.now(),
          agent,
          status,
        });
      }
    );

    return res.json({
      ok: true,
      selectedOrderId: requestedOrder.id,
      agentStream,
      result,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(staticPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });
}

app.listen(port, () => {
  console.log(`T7 Logistics API running on http://localhost:${port}`);
});
