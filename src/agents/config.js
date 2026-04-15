import dotenv from "dotenv";

dotenv.config();

const viteEnv = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
const nodeEnv = typeof process !== "undefined" ? process.env : {};

const LLM_PROVIDER = (
  viteEnv.VITE_LLM_PROVIDER ||
  nodeEnv.VITE_LLM_PROVIDER ||
  nodeEnv.LLM_PROVIDER ||
  "ollama"
).toLowerCase();

const OPENAI_API_KEY =
  viteEnv.VITE_OPENAI_API_KEY ||
  nodeEnv.VITE_OPENAI_API_KEY ||
  nodeEnv.OPENAI_API_KEY ||
  viteEnv.VITE_LLM_API_KEY ||
  nodeEnv.VITE_LLM_API_KEY ||
  nodeEnv.LLM_API_KEY;

const OPENAI_BASE_URL =
  viteEnv.VITE_OPENAI_BASE_URL ||
  nodeEnv.VITE_OPENAI_BASE_URL ||
  nodeEnv.OPENAI_BASE_URL ||
  "https://api.openai.com/v1/chat/completions";

const OPENAI_MODEL =
  viteEnv.VITE_OPENAI_MODEL ||
  nodeEnv.VITE_OPENAI_MODEL ||
  nodeEnv.OPENAI_MODEL ||
  viteEnv.VITE_LLM_MODEL ||
  nodeEnv.VITE_LLM_MODEL ||
  nodeEnv.LLM_MODEL ||
  "gpt-4o-mini";

const OLLAMA_BASE_URL =
  viteEnv.VITE_OLLAMA_BASE_URL ||
  nodeEnv.VITE_OLLAMA_BASE_URL ||
  nodeEnv.OLLAMA_BASE_URL ||
  "http://localhost:11434";

const OLLAMA_MODEL =
  viteEnv.VITE_OLLAMA_MODEL ||
  nodeEnv.VITE_OLLAMA_MODEL ||
  nodeEnv.OLLAMA_MODEL ||
  viteEnv.VITE_LLM_MODEL ||
  nodeEnv.VITE_LLM_MODEL ||
  nodeEnv.LLM_MODEL ||
  "gemma3";

const OLLAMA_TEMPERATURE = Number(
  viteEnv.VITE_OLLAMA_TEMPERATURE ||
  nodeEnv.VITE_OLLAMA_TEMPERATURE ||
  nodeEnv.OLLAMA_TEMPERATURE ||
  "0.1"
);

const OLLAMA_NUM_CTX = Number(
  viteEnv.VITE_OLLAMA_NUM_CTX ||
  nodeEnv.VITE_OLLAMA_NUM_CTX ||
  nodeEnv.OLLAMA_NUM_CTX ||
  "2048"
);

const OLLAMA_NUM_PREDICT = Number(
  viteEnv.VITE_OLLAMA_NUM_PREDICT ||
  nodeEnv.VITE_OLLAMA_NUM_PREDICT ||
  nodeEnv.OLLAMA_NUM_PREDICT ||
  "320"
);

const OLLAMA_KEEP_ALIVE =
  viteEnv.VITE_OLLAMA_KEEP_ALIVE ||
  nodeEnv.VITE_OLLAMA_KEEP_ALIVE ||
  nodeEnv.OLLAMA_KEEP_ALIVE ||
  "10m";

function getAgentPredictBudget(agentName) {
  const budgets = {
    "Inventory Agent": 220,
    "Store Agent": 300,
    "Dispatch Agent": 280,
    "Route Agent": 320,
    "Demand Agent": 260,
  };

  return budgets[agentName] || OLLAMA_NUM_PREDICT;
}

function getOllamaRequest(systemPrompt, userMessage, agentName = "Agent") {
  return {
    url: `${OLLAMA_BASE_URL}/api/chat`,
    options: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        format: "json",
        keep_alive: OLLAMA_KEEP_ALIVE,
        options: {
          temperature: OLLAMA_TEMPERATURE,
          num_ctx: OLLAMA_NUM_CTX,
          num_predict: getAgentPredictBudget(agentName),
          top_k: 20,
          top_p: 0.9,
        },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    },
  };
}

function stripCodeFences(raw) {
  return raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
}

function extractJsonCandidate(raw) {
  const cleaned = stripCodeFences(raw);
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return cleaned.slice(firstBrace, lastBrace + 1);
  }

  return cleaned;
}

function tryParseJson(raw) {
  const directCandidate = stripCodeFences(raw);

  try {
    return JSON.parse(directCandidate);
  } catch {
    const extractedCandidate = extractJsonCandidate(raw);
    return JSON.parse(extractedCandidate);
  }
}

function ensureSentence(text) {
  if (typeof text !== "string") {
    return text;
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (/[.!?]$/.test(trimmed)) {
    return trimmed;
  }

  return `${trimmed}...`;
}

function sanitizeReasoningFields(result, keys) {
  if (!result || typeof result !== "object") {
    return result;
  }

  const sanitized = { ...result };
  for (const key of keys) {
    if (typeof sanitized[key] === "string") {
      sanitized[key] = ensureSentence(sanitized[key]);
    }
  }

  return sanitized;
}

function validateRouteResult(result) {
  if (!result || typeof result !== "object") {
    return result;
  }

  const sanitized = sanitizeReasoningFields(result, ["reasoning", "strategy"]);
  const estimated = Number(sanitized.estimatedTimeMins);
  const naive = Number(sanitized.naiveTimeMins);

  if (Number.isFinite(estimated) && Number.isFinite(naive)) {
    let adjustedNaive = naive;

    if (adjustedNaive < estimated) {
      adjustedNaive = estimated;
    }

    const timeSavedMins = Math.max(0, Number((adjustedNaive - estimated).toFixed(1)));
    const timeSavedPercent =
      adjustedNaive > 0 ? Number(((timeSavedMins / adjustedNaive) * 100).toFixed(2)) : 0;

    sanitized.naiveTimeMins = adjustedNaive;
    sanitized.timeSavedMins = timeSavedMins;
    sanitized.timeSavedPercent = timeSavedPercent;
  }

  if (Array.isArray(sanitized.waypoints)) {
    sanitized.waypoints = sanitized.waypoints.map((waypoint, index) => ({
      ...waypoint,
      label: ensureSentence(waypoint.label).replace(/\.\.\.$/, ""),
      note: ensureSentence(waypoint.note),
      lat: waypoint.lat,
      lng: waypoint.lng,
    }));

    if (sanitized.waypoints.length > 0) {
      sanitized.waypoints[0].label = "Pickup";
      sanitized.waypoints[sanitized.waypoints.length - 1].label = "Dropoff";

      if (sanitized.waypoints.length > 2) {
        for (let i = 1; i < sanitized.waypoints.length - 1; i += 1) {
          sanitized.waypoints[i].label = `Transition ${i}`;
        }
      }
    }
  }

  return sanitized;
}

function validateStoreResult(result) {
  if (!result || typeof result !== "object") {
    return result;
  }

  const sanitized = sanitizeReasoningFields(result, ["reasoning"]);

  if (Array.isArray(sanitized.scores)) {
    sanitized.scores = sanitized.scores.map((score) => {
      const inventory = Number(score.inventoryScore) || 0;
      const proximity = Number(score.proximityScore) || 0;
      const load = Number(score.loadScore) || 0;
      const total = Number((inventory * 0.4 + proximity * 0.35 + load * 0.25).toFixed(2));

      return {
        ...score,
        totalScore: total,
      };
    });
  }

  return sanitized;
}

function validateDemandResult(result) {
  return sanitizeReasoningFields(result, ["reasoning"]);
}

function validateDispatchResult(result) {
  return sanitizeReasoningFields(result, ["reasoning"]);
}

function validateInventoryResult(result) {
  return sanitizeReasoningFields(result, ["reasoning"]);
}

function validateAgentResult(agentName, result) {
  switch (agentName) {
    case "Route Agent":
      return validateRouteResult(result);
    case "Store Agent":
      return validateStoreResult(result);
    case "Demand Agent":
      return validateDemandResult(result);
    case "Dispatch Agent":
      return validateDispatchResult(result);
    case "Inventory Agent":
      return validateInventoryResult(result);
    default:
      return result;
  }
}

async function repairOllamaJson(raw, agentName) {
  const repairPrompt = `Convert the following content into valid JSON only.
Return exactly one valid JSON object.
Do not add markdown, comments, or explanation.
Preserve the original structure and fields as closely as possible.

BROKEN JSON:
${raw}`;

  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      format: "json",
      keep_alive: OLLAMA_KEEP_ALIVE,
      options: {
        temperature: 0,
        num_ctx: OLLAMA_NUM_CTX,
        num_predict: Math.max(OLLAMA_NUM_PREDICT, 400),
        top_k: 10,
        top_p: 0.8,
      },
      messages: [
        {
          role: "system",
          content: `You repair malformed JSON for ${agentName}. Output valid JSON only.`,
        },
        {
          role: "user",
          content: repairPrompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`${agentName} JSON repair failed ${response.status}: ${err}`);
  }

  const data = await response.json();
  const repairedRaw = getResponseContent("ollama", data);

  if (!repairedRaw) {
    throw new Error(`${agentName} JSON repair returned an empty response.`);
  }

  return tryParseJson(repairedRaw);
}

function getProviderRequest(systemPrompt, userMessage) {
  if (LLM_PROVIDER === "ollama") {
    return getOllamaRequest(systemPrompt, userMessage);
  }

  return {
    url: OPENAI_BASE_URL,
    options: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    },
  };
}

function getResponseContent(provider, data) {
  if (provider === "ollama") {
    return data?.message?.content;
  }

  return data?.choices?.[0]?.message?.content;
}

export async function callAgent(systemPrompt, userMessage, agentName = "Agent") {
  const startTime = Date.now();

  try {
    let request;

    if (LLM_PROVIDER === "ollama") {
      request = getOllamaRequest(systemPrompt, userMessage, agentName);
    } else {
      if (!OPENAI_API_KEY) {
        throw new Error(
          'Missing API key. Set "OPENAI_API_KEY" or "LLM_API_KEY" in your environment or .env file.'
        );
      }

      request = getProviderRequest(systemPrompt, userMessage);
    }

    const response = await fetch(request.url, request.options);

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`${agentName} API error ${response.status}: ${err}`);
    }

    const data = await response.json();
    const raw = getResponseContent(LLM_PROVIDER, data);

    if (!raw) {
      throw new Error(`${agentName} returned an empty response from ${LLM_PROVIDER}.`);
    }

    let parsed;

    try {
      parsed = tryParseJson(raw);
    } catch (parseError) {
      if (LLM_PROVIDER !== "ollama") {
        throw parseError;
      }

      parsed = await repairOllamaJson(raw, agentName);
    }

    parsed = validateAgentResult(agentName, parsed);

    const latency = Date.now() - startTime;

    return {
      agent: agentName,
      success: true,
      latency_ms: latency,
      result: parsed,
    };
  } catch (error) {
    return {
      agent: agentName,
      success: false,
      latency_ms: Date.now() - startTime,
      error: error.message,
      result: null,
    };
  }
}
