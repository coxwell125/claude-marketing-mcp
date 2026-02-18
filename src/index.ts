import express, { Request, Response } from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import * as z from "zod";

function createServer() {
  const server = new McpServer(
    { name: "marketing-mcp", version: "1.0.0" },
    { capabilities: { tools: {}, logging: {} } }
  );

  server.registerTool(
    "marketing_test",
    {
      title: "Marketing Test",
      description: "Test tool to confirm remote MCP server works",
      inputSchema: { message: z.string() },
    },
    async ({ message }) => ({
      content: [{ type: "text", text: `✅ Remote MCP working. You said: ${message}` }],
    })
  );

  // Add get_meta_spend_today (mock) next to marketing_test
  server.registerTool(
    "get_meta_spend_today",
    {
      title: "Get Meta Spend Today",
      description:
        "Returns today's Meta (Facebook/Instagram) ad spend for a given ad account. Mock implementation for now.",
      inputSchema: z.object({
        account_id: z.string().optional(),
        time_zone: z.string().optional(),
        currency: z.string().optional(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      }),
    },
    async (args: any) => {
      const timeZone = typeof args?.time_zone === "string" && args.time_zone.trim() ? args.time_zone.trim() : "Asia/Kolkata";
      const currency = typeof args?.currency === "string" && args.currency.trim() ? args.currency.trim().toUpperCase() : "INR";
      const accountId = typeof args?.account_id === "string" && args.account_id.trim() ? args.account_id.trim() : "act_mock_000";

      const dateStr = typeof args?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(args.date)
        ? args.date
        : new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

      let seed = 0;
      const s = `${dateStr}|${accountId}`;
      for (let i = 0; i < s.length; i++) seed = (seed * 31 + s.charCodeAt(i)) >>> 0;
      const min = 250;
      const max = 3250;
      const spend = Number((min + (seed % (max - min + 1))).toFixed(2));

      const payload = {
        source: "mock",
        platform: "meta",
        date: dateStr,
        time_zone: timeZone,
        account_id: accountId,
        currency,
        spend,
      };

      return {
        content: [
          { type: "text", text: JSON.stringify(payload) },
          { type: "text", text: `Meta spend for ${dateStr} (${timeZone}) is ${currency} ${spend}` },
        ],
      };
    }
  );

  return server;
}

const app = express();
app.set("trust proxy", 1);
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "marketing-mcp" });
});

app.post("/mcp", async (req: Request, res: Response) => {
  const server = createServer();

  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);

    res.on("close", () => {
      transport.close();
      server.close();
    });
  } catch (err) {
    console.error("MCP error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

app.get("/mcp", (_req, res) => {
  res.status(405).set("Allow", "POST").send("Method Not Allowed");
});

const PORT = Number(process.env.PORT || 8787);
app.listen(PORT, () => {
  console.log(`🚀 Remote MCP running on port ${PORT}`);
});
