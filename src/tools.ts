// src/tools.ts
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

function isoDateInTZ(timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date()); // YYYY-MM-DD
}

function stableMockSpend(dateStr: string, accountId: string): number {
  let seed = 0;
  const s = `${dateStr}|${accountId}`;
  for (let i = 0; i < s.length; i++) seed = (seed * 31 + s.charCodeAt(i)) >>> 0;

  const min = 250;
  const max = 3250;
  const value = min + (seed % (max - min + 1));
  return Number(value.toFixed(2));
}

export const tools: Tool[] = [
  {
    name: "marketing_test",
    title: "Marketing Test",
    description: "Test tool to confirm remote MCP server works",
    inputSchema: {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        message: { type: "string" },
      },
      required: ["message"],
      additionalProperties: false,
    },
  },

  // ✅ NEW TOOL (MOCK): get_meta_spend_today
  {
    name: "get_meta_spend_today",
    title: "Get Meta Spend Today",
    description:
      "Returns today's Meta (Facebook/Instagram) ad spend for a given ad account. Mock implementation for now.",
    inputSchema: {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        account_id: {
          type: "string",
          description: "Meta Ad Account ID (e.g., act_123...). Optional for mock.",
        },
        time_zone: {
          type: "string",
          description: "IANA timezone (e.g., Asia/Kolkata). Defaults to Asia/Kolkata.",
        },
        currency: {
          type: "string",
          description: "ISO currency code. Defaults to INR.",
        },
        date: {
          type: "string",
          description:
            "Override date in YYYY-MM-DD. If omitted, uses today in time_zone.",
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
];

export async function callTool(
  name: string,
  args: Record<string, any> | undefined
): Promise<CallToolResult> {
  const arguments_ = args ?? {};

  if (name === "marketing_test") {
    const msg = typeof arguments_.message === "string" ? arguments_.message : "";
    return {
      content: [{ type: "text", text: `Remote MCP working. You said: ${msg}` }],
    };
  }

  if (name === "get_meta_spend_today") {
    const timeZone =
      typeof arguments_.time_zone === "string" && arguments_.time_zone.trim()
        ? arguments_.time_zone.trim()
        : "Asia/Kolkata";

    const currency =
      typeof arguments_.currency === "string" && arguments_.currency.trim()
        ? arguments_.currency.trim().toUpperCase()
        : "INR";

    const accountId =
      typeof arguments_.account_id === "string" && arguments_.account_id.trim()
        ? arguments_.account_id.trim()
        : "act_mock_000";

    const dateStr =
      typeof arguments_.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(arguments_.date)
        ? arguments_.date
        : isoDateInTZ(timeZone);

    const spend = stableMockSpend(dateStr, accountId);

    const payload = {
      source: "mock",
      platform: "meta",
      date: dateStr,
      time_zone: timeZone,
      account_id: accountId,
      currency,
      spend,
    };

    // ✅ IMPORTANT: MCP result content must be TEXT (no type:"json")
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(payload),
        },
      ],
    };
  }

  return {
    content: [{ type: "text", text: `MCP error -32602: Tool ${name} not found` }],
    isError: true,
  };
}
