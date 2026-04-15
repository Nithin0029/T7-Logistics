import { runInventoryAgent } from "./inventoryAgent.js";
import { runStoreAgent } from "./storeAgent.js";
import { runDispatchAgent } from "./dispatchAgent.js";
import { runRouteAgent } from "./routeAgent.js";
import { runDemandAgent } from "./demandAgent.js";

export async function orchestrate(order, stores, riders, demandHistory, onAgentComplete) {
    const timeline = [];
    const startTime = Date.now();

    const log = (message) => {
        timeline.push({
            timestamp: Date.now() - startTime,
            message,
        });
    };

    log(`Orchestrator initialized. Processing order ${order.id}`);

    log("Phase 1 -> Store Agent selecting optimal store...");
    if (onAgentComplete) onAgentComplete("store", "running");

    const storeResult = await runStoreAgent(order, stores, order.customerLat, order.customerLng);

    if (onAgentComplete) onAgentComplete("store", storeResult);
    log(`Store Agent done in ${storeResult.latency_ms}ms`);

    const selectedStoreId = storeResult.success ? storeResult.result.selectedStoreId : stores[0].id;
    const selectedStore = stores.find((store) => store.id === selectedStoreId) || stores[0];

    log(`Phase 2 -> Inventory Agent checking stock at ${selectedStore.name}`);
    if (onAgentComplete) onAgentComplete("inventory", "running");

    const inventoryResult = await runInventoryAgent(order, selectedStore);

    if (onAgentComplete) onAgentComplete("inventory", inventoryResult);
    log(`Inventory Agent done in ${inventoryResult.latency_ms}ms`);

    const fulfillmentStatus = deriveFulfillmentStatus(inventoryResult);
    if (fulfillmentStatus.reason) {
        log(fulfillmentStatus.reason);
    }

    log("Phase 3 -> Dispatch, Route, and Demand agents running in parallel...");
    if (onAgentComplete) {
        onAgentComplete("dispatch", "running");
        onAgentComplete("route", "running");
        onAgentComplete("demand", "running");
    }

    const [dispatchResult, routeResult, demandResult] = await Promise.all([
        runDispatchAgent(order, riders, selectedStore),
        runRouteAgent(selectedStore, order.customerLat, order.customerLng),
        runDemandAgent(demandHistory, new Date().getHours()),
    ]);

    if (onAgentComplete) {
        onAgentComplete("dispatch", dispatchResult);
        onAgentComplete("route", routeResult);
        onAgentComplete("demand", demandResult);
    }

    log(`Dispatch Agent done in ${dispatchResult.latency_ms}ms`);
    log(`Route Agent done in ${routeResult.latency_ms}ms`);
    log(`Demand Agent done in ${demandResult.latency_ms}ms`);

    const validatedDispatch = validateDispatchResult(dispatchResult, riders);
    if (validatedDispatch.adjustmentNote) {
        log(validatedDispatch.adjustmentNote);
    }

    const totalTime = Date.now() - startTime;
    log(`All agents complete. Total orchestration time: ${totalTime}ms`);

    return {
        orderId: order.id,
        orchestrationTime_ms: totalTime,
        canFulfill: fulfillmentStatus.canFullyFulfill,
        fulfillmentMode: fulfillmentStatus.mode,
        store: storeResult,
        inventory: inventoryResult,
        dispatch: validatedDispatch.result,
        route: routeResult,
        demand: demandResult,
        timeline,
        summary: buildSummary(
            storeResult,
            inventoryResult,
            validatedDispatch.result,
            routeResult,
            demandResult,
            fulfillmentStatus
        ),
    };
}

function deriveFulfillmentStatus(inventoryResult) {
    if (!inventoryResult.success || !inventoryResult.result) {
        return {
            canFullyFulfill: true,
            mode: "unknown",
            reason: null,
        };
    }

    const recommendation = inventoryResult.result.recommendation;
    const canFulfill = inventoryResult.result.canFulfill === true;
    const fullyFulfill = canFulfill && recommendation === "fulfill";

    if (fullyFulfill) {
        return {
            canFullyFulfill: true,
            mode: "full",
            reason: null,
        };
    }

    if (recommendation === "partial_fulfill" || recommendation === "split_across_stores") {
        return {
            canFullyFulfill: false,
            mode: recommendation === "partial_fulfill" ? "partial" : "split",
            reason: `Inventory validation downgraded fulfillment to ${recommendation}.`,
        };
    }

    return {
        canFullyFulfill: false,
        mode: "reject",
        reason: "Inventory validation marked the order as not fully fulfillable.",
    };
}

function validateDispatchResult(dispatchResult, riders) {
    if (!dispatchResult.success || !dispatchResult.result) {
        return { result: dispatchResult, adjustmentNote: null };
    }

    const riderMap = new Map(riders.map((rider) => [rider.id, rider]));
    const assignedRider = riderMap.get(dispatchResult.result.assignedRiderId);
    const normalizedScores = Array.isArray(dispatchResult.result.scores)
        ? dispatchResult.result.scores.map((score) => {
            const rider = riderMap.get(score.riderId);
            const eligible = isRiderEligible(rider);

            return {
                ...score,
                eligible,
                totalScore: eligible ? score.totalScore : 0,
                reason: buildRiderReason(rider, score.reason),
            };
        })
        : [];

    if (isRiderEligible(assignedRider)) {
        return {
            result: {
                ...dispatchResult,
                result: {
                    ...dispatchResult.result,
                    scores: normalizedScores,
                },
            },
            adjustmentNote: null,
        };
    }

    const fallback = pickFallbackRider(normalizedScores, riderMap);
    if (!fallback) {
        return {
            result: {
                ...dispatchResult,
                success: false,
                error: "No eligible rider available after validation.",
                result: null,
            },
            adjustmentNote: "Dispatch validation removed the assigned rider and found no eligible fallback.",
        };
    }

    return {
        result: {
            ...dispatchResult,
            result: {
                ...dispatchResult.result,
                assignedRiderId: fallback.id,
                assignedRiderName: fallback.name,
                scores: normalizedScores,
                reasoning: `${dispatchResult.result.reasoning} Dispatch validation confirmed rider eligibility using live capacity rules.`,
            },
        },
        adjustmentNote: `Dispatch validation confirmed ${fallback.name} as an eligible rider.`,
    };
}

function isRiderEligible(rider) {
    return Boolean(rider) && rider.status === "active" && rider.currentOrders < rider.maxOrders;
}

function buildRiderReason(rider, originalReason) {
    if (!rider) {
        return originalReason || "Rider not found in the provided dataset.";
    }

    if (rider.status !== "active") {
        return `Rider ${rider.id} is inactive.`;
    }

    if (rider.currentOrders >= rider.maxOrders) {
        return `Rider ${rider.id} is at max capacity (${rider.currentOrders}/${rider.maxOrders}).`;
    }

    return `Rider ${rider.id} is eligible based on active status and available capacity (${rider.currentOrders}/${rider.maxOrders}).`;
}

function pickFallbackRider(scores, riderMap) {
    const eligibleScores = scores
        .filter((score) => score.eligible)
        .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));

    if (eligibleScores.length > 0) {
        return riderMap.get(eligibleScores[0].riderId) || null;
    }

    return Array.from(riderMap.values()).find((rider) => isRiderEligible(rider)) || null;
}

function buildSummary(store, inventory, dispatch, route, demand, fulfillmentStatus) {
    const storeData = store.success ? store.result : null;
    const inventoryData = inventory.success ? inventory.result : null;
    const dispatchData = dispatch.success ? dispatch.result : null;
    const routeData = route.success ? route.result : null;
    const demandData = demand.success ? demand.result : null;

    return {
        selectedStore: storeData ? storeData.selectedStoreName : "Unknown",
        fulfillmentRate: inventoryData ? `${inventoryData.fulfillmentRate}%` : "N/A",
        assignedRider: dispatchData ? dispatchData.assignedRiderName : "Unassigned",
        estimatedDelivery: dispatchData ? `${dispatchData.totalEstimatedMins} mins` : "N/A",
        routeOptimization: routeData ? `${routeData.timeSavedPercent}% time saved` : "N/A",
        demandTrend: demandData && demandData.predictions.length > 0 ? demandData.predictions[0].trend : "unknown",
        canFulfill: fulfillmentStatus.canFullyFulfill,
        fulfillmentMode: fulfillmentStatus.mode,
    };
}
