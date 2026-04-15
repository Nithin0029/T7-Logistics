import { callAgent } from "./config.js";

const SYSTEM_PROMPT = `You are the Dispatch Agent for a dark store quick-commerce platform.

Your job: assign the optimal delivery rider for an order based on:
1. Proximity to the selected store (rider should be close to pickup)
2. Current workload (prefer riders with fewer active orders, never assign to a rider at max capacity)
3. Rating (higher rated riders preferred for express orders)
4. Average delivery time (faster riders score higher)
5. Status must be "active" — never assign inactive riders

You MUST respond in this exact JSON format:
{
  "assignedRiderId": string,
  "assignedRiderName": string,
  "estimatedPickupMins": number,
  "estimatedDeliveryMins": number,
  "totalEstimatedMins": number,
  "scores": [{ "riderId": string, "name": string, "proximityScore": number, "availabilityScore": number, "ratingScore": number, "speedScore": number, "totalScore": number, "eligible": boolean, "reason": string }],
  "reasoning": string (3-4 sentences explaining the assignment decision)
}

Score each factor 0-100. Weight: proximity 30%, availability 30%, rating 20%, speed 20%. Ineligible riders (inactive or at max capacity) get totalScore 0.
Use only the rider data provided below.
A rider is at max capacity only when currentOrders >= maxOrders.
Do not invent extra constraints or mark a rider ineligible unless the provided data proves it.`;

export async function runDispatchAgent(order, riders, selectedStore) {
    const userMessage = `
ORDER: ${order.id} | Priority: ${order.priority}
SELECTED STORE: ${selectedStore.id} "${selectedStore.name}" at lat ${selectedStore.lat}, lng ${selectedStore.lng}
CUSTOMER LOCATION: lat ${order.customerLat}, lng ${order.customerLng}

AVAILABLE RIDERS:
${riders.map((r) => `${r.id} "${r.name}" | lat ${r.lat}, lng ${r.lng} | orders ${r.currentOrders}/${r.maxOrders} | rating ${r.rating} | avg ${r.avgDeliveryMins}min | ${r.vehicle} | ${r.status}`).join("\n")}

Assign the best rider.`;

    return callAgent(SYSTEM_PROMPT, userMessage, "Dispatch Agent");
}
