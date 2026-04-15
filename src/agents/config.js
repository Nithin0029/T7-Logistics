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

function getOllamaRequest(systemPrompt, userMessage) {
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
        options: {
          temperature: 0.3,
        },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    },
  };
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
      request = getOllamaRequest(systemPrompt, userMessage);
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

    const parsed = JSON.parse(raw);
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
