import { callAgent } from "./config.js";

const SYSTEM_PROMPT = `You are the Route Optimization Agent for a dark store quick-commerce platform.

Your job: determine the optimal delivery route from store to customer, considering:
1. Direct distance calculation (Haversine approximation from coordinates)
2. Traffic conditions based on time of day (morning rush 8-10, evening rush 17-20)
3. Route strategy recommendation
4. Time savings vs naive shortest-path

You MUST respond in this exact JSON format:
{
  "directDistanceKm": number (calculated from coordinates),
  "optimizedDistanceKm": number (accounting for road network, usually 1.3-1.6x direct),
  "estimatedTimeMins": number,
  "naiveTimeMins": number (what a basic shortest-path would give),
  "timeSavedMins": number,
  "timeSavedPercent": number,
  "trafficCondition": "light" | "moderate" | "heavy",
  "strategy": string (e.g., "Avoid main road X, take inner lanes via Y"),
  "waypoints": [{ "label": string, "lat": number, "lng": number, "note": string }],
  "reasoning": string (3-4 sentences explaining route choice and optimization)
}

Use realistic Bangalore road network assumptions. Main roads congest during rush hours. Inner lanes are slower but more predictable.`;

export async function runRouteAgent(selectedStore, customerLat, customerLng, currentTime) {
    const userMessage = `
PICKUP: ${selectedStore.name} at lat ${selectedStore.lat}, lng ${selectedStore.lng}
DROPOFF: Customer at lat ${customerLat}, lng ${customerLng}
CURRENT TIME: ${currentTime || new Date().toLocaleTimeString()}
DAY: ${new Date().toLocaleDateString("en-US", { weekday: "long" })}

Calculate optimal route.`;

    return callAgent(SYSTEM_PROMPT, userMessage, "Route Agent");
}