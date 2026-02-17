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
      inputSchema: {
        message: z.string().describe("Any message"),
      },
    },
    async ({ message }) => {
      return {
        content: [
          {
            type: "text",
            text: `✅ Remote MCP working. You said: ${message}`,
          },
        ],
      };
    }
  );

  return server;
}

const app = express();

// Render behind proxy
app.set("trust proxy", 1);

// CORS (allow all for internal tool server; tighten later if needed)
app.use(cors({ origin: "*" }));

// JSON body
app.use(express.json({ limit: "1mb" }));

// Health check (must be reachable)
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "marketing-mcp" });
});

// MCP endpoint (JSON-RPC over Streamable HTTP)
app.post("/mcp", async (req: Request, res: Response) => {
  const server = createServer();

  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
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

// Block GET /mcp
app.get("/mcp", (_req, res) => {
  res.status(405).set("Allow", "POST").send("Method Not Allowed");
});

const PORT = Number(process.env.PORT || 8787);
app.listen(PORT, () => {
  console.log(`🚀 Remote MCP running on port ${PORT}`);
});
