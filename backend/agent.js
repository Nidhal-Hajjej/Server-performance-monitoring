// agent.js
// A small tool-using AI agent that reasons about server health.
// It is a genuine agent loop: the model decides which tools to call
// (current stats, historical stats) before producing a final answer.

const Anthropic = require("@anthropic-ai/sdk");

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY, // set this in your environment
});

const MODEL = "claude-sonnet-5"; // swap for whichever model you have access to

const tools = [
  {
    name: "get_current_stats",
    description:
      "Run server-stats.sh right now and return the raw CPU, memory, disk, and process output.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_history",
    description:
      "Get the last N recorded snapshots of server stats, oldest first, to spot trends over time.",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "integer", description: "How many past snapshots to return (default 10)" },
      },
    },
  },
];

const SYSTEM_PROMPT = `You are a server health assistant. You have tools to fetch live and
historical stats from a Linux server. Use them as needed before answering.
Be concrete: call out specific numbers (CPU %, memory %, disk %, which process is heavy),
flag anything that looks like a problem (e.g. sustained high CPU, memory near full,
disk usage above 85%), and suggest one or two next steps when something looks off.
If everything looks healthy, say so plainly instead of inventing concerns.`;

/**
 * Run the agent loop for a single user question.
 * @param {string} question
 * @param {{getCurrentStats: () => Promise<string>, getHistory: (limit:number) => object[]}} handlers
 */
async function runAgent(question, handlers) {
  const messages = [{ role: "user", content: question }];

  for (let turn = 0; turn < 5; turn++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    const toolUses = response.content.filter((b) => b.type === "tool_use");

    if (toolUses.length === 0) {
      // Final answer: concatenate any text blocks
      return response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");
    }

    // Agent asked for tools — run them and feed results back
    messages.push({ role: "assistant", content: response.content });

    const toolResults = [];
    for (const call of toolUses) {
      let result;
      try {
        if (call.name === "get_current_stats") {
          result = await handlers.getCurrentStats();
        } else if (call.name === "get_history") {
          const limit = call.input?.limit || 10;
          result = JSON.stringify(handlers.getHistory(limit));
        } else {
          result = `Unknown tool: ${call.name}`;
        }
      } catch (err) {
        result = `Error running tool ${call.name}: ${err.message}`;
      }
      toolResults.push({
        type: "tool_result",
        tool_use_id: call.id,
        content: String(result),
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  return "The agent couldn't reach a final answer in time — try a narrower question.";
}

module.exports = { runAgent };
