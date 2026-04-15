import { useEffect, useMemo, useState } from "react";

const AGENT_ORDER = ["store", "inventory", "dispatch", "route", "demand"];
const DASHBOARD_VIEWS = ["map", "table", "board", "flow"];
const OPERATIONS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "serviceRates", label: "Service Rates" },
  { id: "scheduler", label: "Scheduler" },
  { id: "orderConfig", label: "Order Config" },
  { id: "aiAgents", label: "AI Agents" },
];

const agentLabels = {
  store: "Store Agent",
  inventory: "Inventory Agent",
  dispatch: "Dispatch Agent",
  route: "Route Agent",
  demand: "Demand Agent",
};

function formatJson(value) {
  return JSON.stringify(value, null, 2);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizePoint(lat, lng) {
  const left = clamp(((lng - 77.61) / 0.04) * 100, 8, 92);
  const top = clamp(((12.99 - lat) / 0.08) * 100, 10, 90);
  return { left, top };
}

function StatusPill({ children, tone = "neutral" }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

function SidebarSection({ title, children }) {
  return (
    <section className="sidebar-section">
      <h4>{title}</h4>
      {children}
    </section>
  );
}

function buildBoardColumns(simulation, selectedOrder) {
  const result = simulation?.result;
  const summary = result?.summary;

  return [
    {
      title: "Created",
      items: selectedOrder
        ? [
            {
              id: selectedOrder.id,
              tag: "Created",
              headline: selectedOrder.items.join(", "),
              metaA: `Priority: ${selectedOrder.priority}`,
              metaB: `Placed: ${new Date(selectedOrder.placedAt).toLocaleTimeString()}`,
            },
          ]
        : [],
    },
    {
      title: "Optimizing",
      items: result?.store?.success
        ? [
            {
              id: `${result.orderId}-store`,
              tag: "Store Locked",
              headline: summary?.selectedStore || "Pending",
              metaA: `Mode: ${summary?.fulfillmentMode || "pending"}`,
              metaB: `Fulfillment: ${summary?.fulfillmentRate || "N/A"}`,
            },
          ]
        : [],
    },
    {
      title: "Dispatched",
      items: result?.dispatch?.success
        ? [
            {
              id: `${result.orderId}-dispatch`,
              tag: "Driver Assigned",
              headline: result.dispatch.result.assignedRiderName,
              metaA: `ETA: ${result.dispatch.result.totalEstimatedMins} mins`,
              metaB: `Pickup: ${result.dispatch.result.estimatedPickupMins} mins`,
            },
          ]
        : [],
    },
    {
      title: "Forecasting",
      items: result?.demand?.success
        ? [
            {
              id: `${result.orderId}-demand`,
              tag: "Demand",
              headline: `${result.demand.result.predictions?.[0]?.trend || "stable"} trend`,
              metaA: `Peak Hour: ${result.demand.result.peakHour || "N/A"}`,
              metaB: `Action: ${result.demand.result.riderRecommendation?.action || "maintain"}`,
            },
          ]
        : [],
    },
  ];
}

function getAgentCards(result) {
  if (!result) return [];

  return AGENT_ORDER.map((key) => ({
    key,
    label: agentLabels[key],
    payload: result[key],
  }));
}

function DashboardWorkspace({
  bootstrap,
  selectedOrder,
  simulation,
  activeDashboardView,
  setActiveDashboardView,
}) {
  const summary = simulation?.result?.summary;
  const boardColumns = buildBoardColumns(simulation, selectedOrder);
  const selectedStoreId = simulation?.result?.store?.result?.selectedStoreId;
  const selectedRiderId = simulation?.result?.dispatch?.result?.assignedRiderId;
  const routeWaypoints = simulation?.result?.route?.result?.waypoints || [];

  const mapEntities = useMemo(() => {
    if (!bootstrap) {
      return { stores: [], riders: [], customer: null };
    }

    return {
      stores: bootstrap.stores.map((store) => ({
        ...store,
        point: normalizePoint(store.lat, store.lng),
      })),
      riders: bootstrap.riders.map((rider) => ({
        ...rider,
        point: normalizePoint(rider.lat, rider.lng),
      })),
      customer: selectedOrder
        ? {
            id: selectedOrder.id,
            point: normalizePoint(selectedOrder.customerLat, selectedOrder.customerLng),
          }
        : null,
    };
  }, [bootstrap, selectedOrder]);

  return (
    <>
      <section className="summary-strip">
        <div className="summary-stat">
          <span>Selected Store</span>
          <strong>{summary?.selectedStore || "Awaiting run"}</strong>
        </div>
        <div className="summary-stat">
          <span>Fulfillment</span>
          <strong>{summary?.fulfillmentRate || "N/A"}</strong>
        </div>
        <div className="summary-stat">
          <span>Assigned Rider</span>
          <strong>{summary?.assignedRider || "Pending"}</strong>
        </div>
        <div className="summary-stat">
          <span>ETA</span>
          <strong>{summary?.estimatedDelivery || "N/A"}</strong>
        </div>
        <div className="summary-stat">
          <span>Demand Trend</span>
          <strong>{summary?.demandTrend || "unknown"}</strong>
        </div>
      </section>

      <div className="workspace-toolbar">
        <div className="view-tabs">
          {DASHBOARD_VIEWS.map((view) => (
            <button
              key={view}
              className={`view-tab ${activeDashboardView === view ? "active" : ""}`}
              onClick={() => setActiveDashboardView(view)}
            >
              {view}
            </button>
          ))}
        </div>
        <div className="workspace-badges">
          <StatusPill tone="neutral">{simulation?.result?.orderId || "No active order"}</StatusPill>
          <StatusPill tone="neutral">
            {summary?.fulfillmentMode ? `${summary.fulfillmentMode} fulfillment` : "Awaiting run"}
          </StatusPill>
        </div>
      </div>

      {activeDashboardView === "map" ? (
        <section className="map-panel">
          <div className="map-surface">
            <div className="zone zone-primary">
              <span>West Service Zone</span>
            </div>
            <div className="zone zone-secondary">
              <span>Downtown Zone</span>
            </div>
            <div className="map-grid-overlay" />

            {mapEntities.stores.map((store) => (
              <div
                key={store.id}
                className={`map-node store-node ${selectedStoreId === store.id ? "active" : ""}`}
                style={{ left: `${store.point.left}%`, top: `${store.point.top}%` }}
                title={store.name}
              >
                <span>{store.name}</span>
              </div>
            ))}

            {mapEntities.riders.map((rider) => (
              <div
                key={rider.id}
                className={`map-node rider-node ${selectedRiderId === rider.id ? "active" : ""}`}
                style={{ left: `${rider.point.left}%`, top: `${rider.point.top}%` }}
                title={rider.name}
              />
            ))}

            {mapEntities.customer ? (
              <div
                className="map-node customer-node"
                style={{
                  left: `${mapEntities.customer.point.left}%`,
                  top: `${mapEntities.customer.point.top}%`,
                }}
                title="Customer"
              />
            ) : null}

            {routeWaypoints.length > 1 ? (
              <svg className="route-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                <polyline
                  points={routeWaypoints
                    .map((waypoint) => {
                      const point = normalizePoint(waypoint.lat, waypoint.lng);
                      return `${point.left},${point.top}`;
                    })
                    .join(" ")}
                />
              </svg>
            ) : null}
          </div>

          <div className="map-footer">
            <div className="mini-stat">
              <span>Stores</span>
              <strong>{bootstrap?.stores?.length || 0}</strong>
            </div>
            <div className="mini-stat">
              <span>Riders</span>
              <strong>{bootstrap?.riders?.length || 0}</strong>
            </div>
            <div className="mini-stat">
              <span>ETA</span>
              <strong>{summary?.estimatedDelivery || "N/A"}</strong>
            </div>
            <div className="mini-stat">
              <span>Demand</span>
              <strong>{summary?.demandTrend || "unknown"}</strong>
            </div>
          </div>
        </section>
      ) : null}

      {activeDashboardView === "table" ? (
        <section className="table-panel card-surface">
          <table className="ops-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Value</th>
                <th>Insight</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Order</td>
                <td>{selectedOrder?.id || "N/A"}</td>
                <td>{selectedOrder?.items?.join(", ") || "No order selected"}</td>
              </tr>
              <tr>
                <td>Fulfillment Mode</td>
                <td>{summary?.fulfillmentMode || "pending"}</td>
                <td>{summary?.fulfillmentRate || "Awaiting run"}</td>
              </tr>
              <tr>
                <td>Store</td>
                <td>{summary?.selectedStore || "Pending"}</td>
                <td>{simulation?.result?.store?.result?.reasoning || "No store reasoning yet"}</td>
              </tr>
              <tr>
                <td>Route</td>
                <td>{summary?.routeOptimization || "N/A"}</td>
                <td>{simulation?.result?.route?.result?.strategy || "No route strategy yet"}</td>
              </tr>
              <tr>
                <td>Demand</td>
                <td>{summary?.demandTrend || "unknown"}</td>
                <td>{simulation?.result?.demand?.result?.riderRecommendation?.action || "Awaiting forecast"}</td>
              </tr>
            </tbody>
          </table>
        </section>
      ) : null}

      {activeDashboardView === "board" ? (
        <section className="board-panel">
          {boardColumns.map((column) => (
            <div className="board-column" key={column.title}>
              <div className="board-column-header">
                <h3>{column.title}</h3>
                <span>{column.items.length}</span>
              </div>
              {column.items.length ? (
                column.items.map((item) => (
                  <article className="board-card" key={item.id}>
                    <StatusPill tone="accent">{item.tag}</StatusPill>
                    <h4>{item.headline}</h4>
                    <p>{item.metaA}</p>
                    <p>{item.metaB}</p>
                  </article>
                ))
              ) : (
                <div className="board-empty">No cards yet</div>
              )}
            </div>
          ))}
        </section>
      ) : null}

      {activeDashboardView === "flow" ? (
        <section className="flow-panel card-surface">
          <div className="flow-track">
            {AGENT_ORDER.map((agentKey, index) => (
              <div className="flow-node-group" key={agentKey}>
                <div className="flow-node">
                  <span className="flow-title">{agentLabels[agentKey]}</span>
                  <small>
                    {simulation?.result?.[agentKey]?.success
                      ? `${simulation.result[agentKey].latency_ms}ms`
                      : "Awaiting run"}
                  </small>
                </div>
                {index < AGENT_ORDER.length - 1 ? <div className="flow-link" /> : null}
              </div>
            ))}
          </div>
          <p className="flow-caption">
            This workflow mirrors the Fleetbase-style activity flow concept, but tuned for AI
            coordination across dark-store operations.
          </p>
        </section>
      ) : null}
    </>
  );
}

function ServiceRatesWorkspace({ simulation }) {
  const route = simulation?.result?.route?.result;
  const distance = route?.optimizedDistanceKm || 2.5;
  const demandAction = simulation?.result?.demand?.result?.riderRecommendation?.action || "maintain";
  const surgeMultiplier = demandAction === "increase" ? 1.35 : 1.05;
  const expressRate = (39 + distance * 11 * surgeMultiplier).toFixed(0);
  const standardRate = (22 + distance * 8).toFixed(0);
  const heavyBasketRate = (49 + distance * 13 * surgeMultiplier).toFixed(0);

  return (
    <section className="workspace-stack">
      <div className="workspace-header-card">
        <h2>Service Rates Engine</h2>
        <p>
          Dynamic pricing for dark-store delivery tiers using route complexity, rider demand, and
          service urgency.
        </p>
      </div>

      <div className="rates-grid">
        <article className="rate-card">
          <StatusPill tone="accent">Express</StatusPill>
          <h3>10-minute promise</h3>
          <strong>Rs. {expressRate}</strong>
          <p>Best for high-priority baskets, surge-sensitive fulfillment, and short delivery radii.</p>
        </article>
        <article className="rate-card">
          <StatusPill tone="neutral">Standard</StatusPill>
          <h3>Slot-based delivery</h3>
          <strong>Rs. {standardRate}</strong>
          <p>Balanced cost model for medium urgency orders with more rider flexibility.</p>
        </article>
        <article className="rate-card">
          <StatusPill tone="success">Bulk Basket</StatusPill>
          <h3>High-AOV handling</h3>
          <strong>Rs. {heavyBasketRate}</strong>
          <p>Supports larger carts, heavier packs, and dispatch preference for high-capacity riders.</p>
        </article>
      </div>

      <div className="ops-dual-grid">
        <section className="card-surface padded-card">
          <h3>Pricing Drivers</h3>
          <div className="detail-list">
            <div><span>Optimized Distance</span><strong>{distance} km</strong></div>
            <div><span>Demand Action</span><strong>{demandAction}</strong></div>
            <div><span>Surge Multiplier</span><strong>{surgeMultiplier.toFixed(2)}x</strong></div>
            <div><span>Route Complexity</span><strong>{route?.trafficCondition || "moderate"}</strong></div>
          </div>
        </section>

        <section className="card-surface padded-card">
          <h3>Policy Suggestions</h3>
          <ul className="comfort-list">
            <li>Auto-apply express surcharge only when rider utilization crosses 70%.</li>
            <li>Discount standard deliveries in off-peak hours to flatten demand spikes.</li>
            <li>Reserve bulk basket handling for riders with lower current order load.</li>
          </ul>
        </section>
      </div>
    </section>
  );
}

function SchedulerWorkspace({ bootstrap, simulation }) {
  const demand = simulation?.result?.demand?.result;
  const recommended = demand?.riderRecommendation?.nextHourRidersNeeded || 8;

  return (
    <section className="workspace-stack">
      <div className="workspace-header-card">
        <h2>Ops Scheduler</h2>
        <p>Plan rider coverage, replenishment windows, and dispatch capacity around near-term demand.</p>
      </div>

      <div className="ops-dual-grid">
        <section className="card-surface padded-card">
          <h3>Rider Shift Board</h3>
          <div className="schedule-list">
            {bootstrap?.riders?.map((rider, index) => (
              <div className="schedule-row" key={rider.id}>
                <div>
                  <strong>{rider.name}</strong>
                  <span>{rider.status === "active" ? "On route-ready shift" : "Reserve / inactive"}</span>
                </div>
                <div>
                  <strong>{`${8 + index}:00 - ${14 + index}:00`}</strong>
                  <span>{rider.currentOrders}/{rider.maxOrders} active capacity</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card-surface padded-card">
          <h3>Demand Windows</h3>
          <div className="timeline-stack">
            {(demand?.predictions || []).map((prediction) => (
              <div className="timeline-bar" key={prediction.hour}>
                <div>
                  <strong>{prediction.hour}:00</strong>
                  <span>{prediction.trend}</span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${Math.min(prediction.predictedOrders, 100)}%` }} />
                </div>
                <strong>{prediction.predictedOrders} orders</strong>
              </div>
            ))}
          </div>
          <div className="schedule-alert">
            Recommended active riders next hour: <strong>{recommended}</strong>
          </div>
        </section>
      </div>
    </section>
  );
}

function OrderConfigWorkspace() {
  const steps = [
    { title: "Order Created", detail: "Capture items, customer location, and delivery promise." },
    { title: "Store Selected", detail: "Choose dark store using inventory, load, and proximity." },
    { title: "Inventory Validated", detail: "Resolve full, partial, or split fulfillment mode." },
    { title: "Rider Assigned", detail: "Dispatch best rider using capacity and ETA constraints." },
    { title: "Delivered", detail: "Close order, update demand memory, and log SLA." },
  ];

  return (
    <section className="workspace-stack">
      <div className="workspace-header-card">
        <h2>Order Configuration</h2>
        <p>
          Configure orchestration rules and the operational flow that powers dark-store fulfillment.
        </p>
      </div>

      <div className="config-grid">
        <section className="card-surface padded-card">
          <h3>Activity Flow</h3>
          <div className="config-flow">
            {steps.map((step, index) => (
              <div className="config-flow-node" key={step.title}>
                <strong>{step.title}</strong>
                <span>{step.detail}</span>
                {index < steps.length - 1 ? <div className="config-flow-link" /> : null}
              </div>
            ))}
          </div>
        </section>

        <section className="card-surface padded-card">
          <h3>Policy Rules</h3>
          <ul className="comfort-list">
            <li>Reject express orders if no rider can hit SLA after route optimization.</li>
            <li>Allow partial fulfillment only when basket value stays above threshold.</li>
            <li>Escalate to split-order mode when critical item shortage affects only one SKU.</li>
            <li>Increase dispatch urgency when near-term demand is rising for the selected zone.</li>
          </ul>
        </section>
      </div>
    </section>
  );
}

function AIAgentsWorkspace({ simulation, selectedOrder }) {
  const cards = getAgentCards(simulation?.result);

  return (
    <section className="workspace-stack">
      <div className="workspace-header-card">
        <h2>AI Agent Observatory</h2>
        <p>
          Deep visibility into agent execution, structured outputs, reasoning traces, and orchestration
          timing for order {simulation?.result?.orderId || selectedOrder?.id || "N/A"}.
        </p>
      </div>

      <div className="ops-dual-grid">
        <section className="card-surface padded-card">
          <h3>Execution Timeline</h3>
          <div className="activity-list">
            {simulation?.result?.timeline?.length ? (
              simulation.result.timeline.map((entry, index) => (
                <div className="activity-item" key={`${entry.timestamp}-${index}`}>
                  <span className="activity-time">{entry.timestamp}ms</span>
                  <p>{entry.message}</p>
                </div>
              ))
            ) : (
              <p className="empty-state">Run a simulation to inspect agent execution.</p>
            )}
          </div>
        </section>

        <section className="card-surface padded-card">
          <h3>Agent Performance</h3>
          <div className="latency-stack">
            {cards.map((card) => (
              <div className="latency-row" key={card.key}>
                <span>{card.label}</span>
                <strong>{card.payload?.latency_ms ? `${card.payload.latency_ms}ms` : "-"}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="agent-grid">
        {cards.map((card) => (
          <article className="agent-panel" key={card.key}>
            <div className="agent-panel-header">
              <div>
                <h3>{card.label}</h3>
                <p>{card.payload?.success ? "Structured response captured" : "No result yet"}</p>
              </div>
              <StatusPill tone={card.payload?.success ? "success" : "neutral"}>
                {card.payload?.success ? "Success" : "Pending"}
              </StatusPill>
            </div>

            {card.payload ? (
              <>
                <div className="agent-meta">
                  <span>Latency: {card.payload.latency_ms}ms</span>
                  <span>{card.payload.success ? "AI agent response" : card.payload.error}</span>
                </div>
                <pre>{formatJson(card.payload.result || card.payload)}</pre>
              </>
            ) : (
              <p className="empty-state">Awaiting orchestration.</p>
            )}
          </article>
        ))}
      </section>
    </section>
  );
}

function RightRail({ summary, simulation, selectedOrder, error }) {
  return (
    <aside className="inspector">
      <section className="inspector-card emphasis">
        <div className="inspector-head">
          <div>
            <span className="muted-label">Active Order</span>
            <h2>{simulation?.result?.orderId || selectedOrder?.id || "No order selected"}</h2>
          </div>
          <StatusPill tone="accent">
            {summary?.fulfillmentMode ? summary.fulfillmentMode.toUpperCase() : "IDLE"}
          </StatusPill>
        </div>

        <div className="inspector-grid">
          <div>
            <span className="muted-label">Store</span>
            <strong>{summary?.selectedStore || "Pending"}</strong>
          </div>
          <div>
            <span className="muted-label">Rider</span>
            <strong>{summary?.assignedRider || "Pending"}</strong>
          </div>
          <div>
            <span className="muted-label">ETA</span>
            <strong>{summary?.estimatedDelivery || "N/A"}</strong>
          </div>
          <div>
            <span className="muted-label">Route Gain</span>
            <strong>{summary?.routeOptimization || "N/A"}</strong>
          </div>
        </div>
      </section>

      <section className="inspector-card">
        <div className="inspector-head">
          <h3>Activity Feed</h3>
        </div>
        <div className="activity-list">
          {simulation?.result?.timeline?.length ? (
            simulation.result.timeline.slice(-6).map((entry, index) => (
              <div className="activity-item" key={`${entry.timestamp}-${index}`}>
                <span className="activity-time">{entry.timestamp}ms</span>
                <p>{entry.message}</p>
              </div>
            ))
          ) : (
            <p className="empty-state">No orchestration activity yet.</p>
          )}
        </div>
      </section>

      <section className="inspector-card">
        <div className="inspector-head">
          <h3>Demand Pulse</h3>
        </div>
        <div className="pulse-grid">
          {(simulation?.result?.demand?.result?.predictions || []).map((prediction) => (
            <div className="pulse-card" key={prediction.hour}>
              <span>{prediction.hour}:00</span>
              <strong>{prediction.predictedOrders}</strong>
              <small>{prediction.trend}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="inspector-card">
        <div className="inspector-head">
          <h3>Ops Notes</h3>
        </div>
        <ul className="comfort-list">
          <li>AI observability is now separated from the operator dashboard to reduce noise.</li>
          <li>Service rates, scheduler, and order config are interactive workspaces instead of dead tabs.</li>
          <li>Use Create new order to refresh the current orchestration scenario.</li>
        </ul>
        {error ? <p className="error-text">{error}</p> : null}
      </section>
    </aside>
  );
}

function buildAdminAlerts(simulation) {
  const alerts = [];
  const inventory = simulation?.result?.inventory?.result;
  const demand = simulation?.result?.demand?.result;
  const summary = simulation?.result?.summary;

  if (inventory?.shortages?.length) {
    inventory.shortages.forEach((shortage) => {
      alerts.push({
        type: "critical",
        title: `Stockout: ${shortage.item}`,
        detail: `Admin attention needed. ${shortage.item} is short by ${shortage.deficit} unit(s) at the selected store.`,
      });
    });
  }

  if (summary?.fulfillmentMode === "partial") {
    alerts.push({
      type: "warning",
      title: "Partial fulfillment triggered",
      detail: "Order cannot be served in full. Inventory fallback or replenishment action is recommended.",
    });
  }

  if (demand?.riderRecommendation?.action === "increase") {
    alerts.push({
      type: "info",
      title: "Demand surge predicted",
      detail: `Demand agent recommends increasing riders to ${demand.riderRecommendation.nextHourRidersNeeded}.`,
    });
  }

  if (!alerts.length) {
    alerts.push({
      type: "success",
      title: "Ops stable",
      detail: "No immediate stock or dispatch escalations detected in the latest orchestration cycle.",
    });
  }

  return alerts;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export default function App() {
  const [bootstrap, setBootstrap] = useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [simulation, setSimulation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [systemHealth, setSystemHealth] = useState("checking");
  const [activeOperation, setActiveOperation] = useState("dashboard");
  const [activeDashboardView, setActiveDashboardView] = useState("map");
  const [autoMode, setAutoMode] = useState(false);
  const [autoIntervalSeconds] = useState(30);
  const [cycleIndex, setCycleIndex] = useState(0);
  const [orderHistory, setOrderHistory] = useState([]);

  const runSimulation = async (overrideOrderId) => {
    setLoading(true);
    setError("");
    setActiveOperation("dashboard");

    try {
      const orderIdToUse = overrideOrderId || selectedOrderId;
      const response = await fetch(`${API_BASE_URL}/api/simulate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId: orderIdToUse }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Simulation failed.");
      }

      setSimulation(data);
      setSystemHealth("ready");
      setOrderHistory((current) => {
        const next = [
          {
            id: data.result?.orderId || orderIdToUse,
            timestamp: new Date().toLocaleTimeString(),
            store: data.result?.summary?.selectedStore || "Pending",
            rider: data.result?.summary?.assignedRider || "Pending",
            fulfillment: data.result?.summary?.fulfillmentMode || "pending",
          },
          ...current,
        ];

        return next.slice(0, 8);
      });
    } catch (err) {
      setSystemHealth("error");
      setError(
        err.message.includes("Failed to fetch")
          ? "API connection failed. Start the backend with `npm run server` and make sure Ollama is running."
          : err.message
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadBootstrap = async () => {
      try {
        const healthResponse = await fetch(`${API_BASE_URL}/api/health`);
        if (!healthResponse.ok) {
          throw new Error("Backend health check failed.");
        }

        setSystemHealth("ready");
        const response = await fetch(`${API_BASE_URL}/api/bootstrap`);
        const data = await response.json();
        setBootstrap(data);
        const defaultOrderId = data.orders?.[0]?.id || "";
        setSelectedOrderId(defaultOrderId);

        if (defaultOrderId) {
          await runSimulation(defaultOrderId);
        }
      } catch (err) {
        setSystemHealth("error");
        setError(
          err.message.includes("Failed to fetch")
            ? "Unable to reach the API. Start the backend with `npm run server` and retry."
            : err.message
        );
      }
    };

    loadBootstrap();
  }, []);

  useEffect(() => {
    if (!autoMode || !bootstrap?.orders?.length) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      setCycleIndex((current) => {
        const nextIndex = (current + 1) % bootstrap.orders.length;
        const nextOrderId = bootstrap.orders[nextIndex].id;
        setSelectedOrderId(nextOrderId);
        runSimulation(nextOrderId);
        return nextIndex;
      });
    }, autoIntervalSeconds * 1000);

    return () => clearInterval(intervalId);
  }, [autoMode, autoIntervalSeconds, bootstrap]);

  const selectedOrder = bootstrap?.orders?.find((order) => order.id === selectedOrderId);
  const summary = simulation?.result?.summary;
  const adminAlerts = buildAdminAlerts(simulation);

  return (
    <div className="ops-shell">
      <aside className="ops-sidebar">
        <div className="brand-lockup">
          <div className="brand-badge">T7</div>
          <div>
            <strong>Fleet-Ops AI</strong>
            <span>Dark-store orchestration</span>
          </div>
        </div>

        <button
          className="create-order-button"
          onClick={() => runSimulation()}
          disabled={loading || !selectedOrderId}
        >
          {loading ? "Running agents..." : "Create new order"}
        </button>

        <SidebarSection title="Operations">
          <nav className="nav-stack">
            {OPERATIONS.map((operation) => (
              <button
                key={operation.id}
                className={`nav-item ${activeOperation === operation.id ? "active" : ""}`}
                onClick={() => setActiveOperation(operation.id)}
              >
                {operation.label}
              </button>
            ))}
          </nav>
        </SidebarSection>

        <SidebarSection title="Resources">
          <div className="resource-list">
            {bootstrap?.riders?.map((rider) => (
              <div className="resource-row" key={rider.id}>
                <span className={`dot ${rider.status === "active" ? "green" : "gray"}`} />
                <span>{rider.name}</span>
              </div>
            ))}
          </div>
        </SidebarSection>

        <SidebarSection title="Dark Stores">
          <div className="resource-list">
            {bootstrap?.stores?.map((store) => (
              <div className="resource-row" key={store.id}>
                <span className="dot amber" />
                <span>{store.name}</span>
              </div>
            ))}
          </div>
        </SidebarSection>
      </aside>

      <div className="ops-main">
        <header className="topbar">
          <div>
            <p className="topbar-label">Inspired by Fleetbase Fleet Ops</p>
            <h1>T7 Autonomous Logistics Console</h1>
          </div>
          <div className="topbar-actions">
            <StatusPill tone={loading ? "running" : "success"}>
              {loading
                ? "Simulation Running"
                : systemHealth === "error"
                  ? "System Degraded"
                  : systemHealth === "checking"
                    ? "Checking API"
                    : "System Ready"}
            </StatusPill>
            <button
              className={`live-mode-button ${autoMode ? "active" : ""}`}
              onClick={() => setAutoMode((current) => !current)}
            >
              {autoMode ? `Live Mode On (${autoIntervalSeconds}s)` : "Enable Live Mode"}
            </button>
            <select
              value={selectedOrderId}
              onChange={(event) => setSelectedOrderId(event.target.value)}
              disabled={!bootstrap || loading}
              className="order-select"
            >
              {bootstrap?.orders?.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.id} - {order.items.join(", ")}
                </option>
              ))}
            </select>
          </div>
        </header>

        <section className="workspace">
          <div className="workspace-main">
            {activeOperation === "dashboard" ? (
              <DashboardWorkspace
                bootstrap={bootstrap}
                selectedOrder={selectedOrder}
                simulation={simulation}
                activeDashboardView={activeDashboardView}
                setActiveDashboardView={setActiveDashboardView}
              />
            ) : null}

            {activeOperation === "serviceRates" ? <ServiceRatesWorkspace simulation={simulation} /> : null}
            {activeOperation === "scheduler" ? <SchedulerWorkspace bootstrap={bootstrap} simulation={simulation} /> : null}
            {activeOperation === "orderConfig" ? <OrderConfigWorkspace /> : null}
            {activeOperation === "aiAgents" ? (
              <AIAgentsWorkspace simulation={simulation} selectedOrder={selectedOrder} />
            ) : null}
          </div>

          <RightRail summary={summary} simulation={simulation} selectedOrder={selectedOrder} error={error} />
        </section>
        <section className="bottom-insights">
          <section className="card-surface padded-card">
            <div className="section-headline">
              <h3>Admin Alerts</h3>
              <StatusPill tone={adminAlerts[0]?.type === "critical" ? "running" : "accent"}>
                {adminAlerts.length} active
              </StatusPill>
            </div>
            <div className="alert-stack">
              {adminAlerts.map((alert, index) => (
                <article className={`alert-card ${alert.type}`} key={`${alert.title}-${index}`}>
                  <strong>{alert.title}</strong>
                  <p>{alert.detail}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="card-surface padded-card">
            <div className="section-headline">
              <h3>Live Order Feed</h3>
              <StatusPill tone={autoMode ? "success" : "neutral"}>
                {autoMode ? "Auto dispatching" : "Manual mode"}
              </StatusPill>
            </div>
            <div className="feed-table">
              <div className="feed-header">
                <span>Order</span>
                <span>Time</span>
                <span>Store</span>
                <span>Rider</span>
                <span>Mode</span>
              </div>
              {orderHistory.length ? (
                orderHistory.map((entry) => (
                  <div className="feed-row" key={`${entry.id}-${entry.timestamp}`}>
                    <span>{entry.id}</span>
                    <span>{entry.timestamp}</span>
                    <span>{entry.store}</span>
                    <span>{entry.rider}</span>
                    <span>{entry.fulfillment}</span>
                  </div>
                ))
              ) : (
                <p className="empty-state">New simulated orders will appear here after each run.</p>
              )}
            </div>
          </section>
        </section>
      </div>
    </div>
  );
}
