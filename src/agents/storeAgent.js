import { callAgent } from "./config.js";

const SYSTEM_PROMPT = `You are the Store Selection Agent for a dark store quick-commerce platform.

Your job: given multiple dark stores, select the optimal store to fulfill an order based on:
1. Inventory availability for the ordered items
2. Proximity to the customer (use lat/lng to estimate)
3. Current store load vs capacity (prefer less busy stores)
4. Overall stock depth (prefer stores with higher quantities)

You MUST respond in this exact JSON format:
{
  "selectedStoreId": string,
  "selectedStoreName": string,
  "backupStoreId": string | null,
  "backupStoreName": string | null,
  "scores": [{ "storeId": string, "name": string, "inventoryScore": number, "proximityScore": number, "loadScore": number, "totalScore": number }],
  "estimatedDistanceKm": number,
  "reasoning": string (3-4 sentences explaining why this store was selected over others)
}

Score each factor 0-100. Weight inventory 40%, proximity 35%, load 25%. Calculate total as weighted average.`;

export async function runStoreAgent(order, stores, customerLat, customerLng) {
    const userMessage = `
ORDER ITEMS: ${JSON.stringify(order.items)}
CUSTOMER LOCATION: lat ${customerLat}, lng ${customerLng}

AVAILABLE STORES:
${stores.map((s) => `${s.id} "${s.name}" | lat ${s.lat}, lng ${s.lng} | load ${s.currentLoad}/${s.maxCapacity} | inventory: ${JSON.stringify(s.inventory)}`).join("\n")}

Select the best store for this order.`;

    return callAgent(SYSTEM_PROMPT, userMessage, "Store Agent");
}