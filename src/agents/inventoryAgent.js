import { callAgent } from "./config.js";

const SYSTEM_PROMPT = `You are the Inventory Agent for a dark store quick-commerce platform.

Your job: determine whether a given order can be fulfilled from a specific store's current inventory.

Analyze each item in the order against available stock. Flag shortages. Suggest partial fulfillment if some items are unavailable.

You MUST respond in this exact JSON format:
{
  "canFulfill": boolean,
  "fulfillableItems": [{ "item": string, "requested": number, "available": number, "status": "in_stock" | "low_stock" | "out_of_stock" }],
  "shortages": [{ "item": string, "deficit": number }],
  "fulfillmentRate": number (0-100, percentage of items available),
  "reasoning": string (2-3 sentences explaining your decision),
  "recommendation": "fulfill" | "partial_fulfill" | "reject" | "split_across_stores"
}

Be precise. An item with 0 stock is out_of_stock. An item with fewer than 5 units is low_stock.`;

export async function runInventoryAgent(order, store) {
    const userMessage = `
ORDER: ${JSON.stringify(order)}
STORE INVENTORY (${store.name}, ${store.id}): ${JSON.stringify(store.inventory)}

Check if this store can fulfill the order. Each order item has quantity 1 unless specified.`;

    return callAgent(SYSTEM_PROMPT, userMessage, "Inventory Agent");
}