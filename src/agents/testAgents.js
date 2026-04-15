import { orchestrate } from "./orchestrator.js";
import { stores, riders, sampleOrders, demandHistory } from "../../data/mockData.js";

async function test() {
  console.log("🚀 Starting orchestration test...\n");

  const result = await orchestrate(
    sampleOrders[0],
    stores,
    riders,
    demandHistory,
    (agent, status) => {
      if (status === "running") {
        console.log(`⏳ ${agent} agent running...`);
      } else {
        console.log(`✅ ${agent} agent complete (${status.latency_ms}ms)`);
      }
    }
  );

  console.log("\n═══ FULFILLMENT PLAN ═══");
  console.log(JSON.stringify(result.summary, null, 2));
  console.log("\n═══ TIMELINE ═══");
  result.timeline.forEach((t) => console.log(`  [${t.timestamp}ms] ${t.message}`));
  console.log("\n═══ FULL RESULTS ═══");
  console.log(JSON.stringify(result, null, 2));
}

test();