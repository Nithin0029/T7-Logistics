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

Rules you must follow:
1. Use only the order items and inventory values provided below.
2. Each order item has quantity 1 unless explicitly stated otherwise.
3. If any required item has available = 0 or available < requested, then "canFulfill" must be false.
4. If all required items are available in full, then "canFulfill" must be true and "recommendation" must be "fulfill".
5. If some but not all required items are available, then "recommendation" must be "partial_fulfill" unless a split across stores is explicitly necessary.
6. "fulfillmentRate" must reflect item-level availability and stay consistent with shortages.
7. An item with 0 stock is "out_of_stock". An item with fewer than 5 units but enough to satisfy the request is "low_stock".
8. Do not say the order can be fulfilled if any item is unavailable.

Be precise and internally consistent.`;

export async function runInventoryAgent(order, store) {
    const userMessage = `
ORDER: ${JSON.stringify(order)}
STORE INVENTORY (${store.name}, ${store.id}): ${JSON.stringify(store.inventory)}

Check if this store can fulfill the order. Each order item has quantity 1 unless specified.`;

    return callAgent(SYSTEM_PROMPT, userMessage, "Inventory Agent");
}
