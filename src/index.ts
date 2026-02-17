import express, { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import * as z from "zod";

/**
 * Create MCP server instance (tools registered here)
 */
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

/**
 * Express app (NO host validation / NO allowedHosts middleware)
 */
const app = createMcpExpressApp({
  allowedOrigins: ["*"], // allow all origins
});

// Required on Render (behind proxy/load balancer)
app.set("trust proxy", 1);

// Ensure JSON body parsing
app.use(express.json({ limit: "1mb" }));

// Optional health check
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

// Block GET /mcp (MCP expects POST)
app.get("/mcp", (_req, res) => {
  res.status(405).set("Allow", "POST").send("Method Not Allowed");
});

const PORT = Number(process.env.PORT || 8787);
app.listen(PORT, () => {
  console.log(`🚀 Remote MCP running on port ${PORT}`);
});
