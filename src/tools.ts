// src/tools.ts

export type JsonSchema = Record<string, any>;

export type ToolDefinition = {
  name: string;
  title?: string;
  description: string;
  inputSchema: JsonSchema;
  execution?: Record<string, any>;
};

export type ToolCallResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export type ToolHandler = (args: any) => Promise<ToolCallResult>;

type ToolRegistryEntry = {
  def: ToolDefinition;
  handler: ToolHandler;
};

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

export const tools: ToolRegistryEntry[] = [
  {
    def: {
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
      execution: { taskSupport: "forbidden" },
    },
    handler: async (args: { message: string }) => {
      const msg = typeof args?.message === "string" ? args.message : "";
      return {
        content: [{ type: "text", text: `Remote MCP working. You said: ${msg}` }],
      };
    },
  },

  // ✅ NEW TOOL (MOCK): get_meta_spend_today
  {
    def: {
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
            description: "Override date in YYYY-MM-DD. If omitted, uses today in time_zone.",
            pattern: "^\\d{4}-\\d{2}-\\d{2}$",
          },
        },
        required: [],
        additionalProperties: false,
      },
      execution: { taskSupport: "forbidden" },
    },
    handler: async (args: any) => {
      const timeZone =
        typeof args?.time_zone === "string" && args.time_zone.trim()
          ? args.time_zone.trim()
          : "Asia/Kolkata";

      const currency =
        typeof args?.currency === "string" && args.currency.trim()
          ? args.currency.trim().toUpperCase()
          : "INR";

      const accountId =
        typeof args?.account_id === "string" && args.account_id.trim()
          ? args.account_id.trim()
          : "act_mock_000";

      const dateStr =
        typeof args?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(args.date)
          ? args.date
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

      // ✅ TEXT ONLY (no type:"json")
      return {
        content: [{ type: "text", text: JSON.stringify(payload) }],
      };
    },
  },
];

export function listToolDefinitions(): ToolDefinition[] {
  return tools.map((t) => t.def);
}

export function findTool(name: string): ToolRegistryEntry | undefined {
  return tools.find((t) => t.def.name === name);
}
