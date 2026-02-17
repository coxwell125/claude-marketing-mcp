import express, { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import * as z from "zod";

/**
 * ✅ Create MCP Server (fresh per request)
 */
const getServer = () => {
  const server = new McpServer(
    { name: "marketing-mcp", version: "1.0.0" },
    { capabilities: { tools: {}, logging: {} } }
  );

  // ✅ Test Tool
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
};

/**
 * ✅ Express App Setup
 */
const app = createMcpExpressApp();

// Important for Render proxy
app.set("trust proxy", 1);

app.use(express.json());

/**
 * ✅ FIX: Allow Render + Local Hosts
 * This fixes:
 * Invalid Host: claude-marketing-mcp.onrender.com
 */
app.use((req, res, next) => {
  const host = (req.headers.host || "").toLowerCase();

  const allowedHosts = new Set([
    "claude-marketing-mcp.onrender.com",
    "localhost:8787",
    "localhost:3001",
    "localhost:3000",
    "127.0.0.1:8787",
    "127.0.0.1:3001",
    "127.0.0.1:3000",
  ]);

  if (!allowedHosts.has(host)) {
    return res.status(400).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: `Invalid Host: ${host}`,
      },
      id: null,
    });
  }

  next();
});

/**
 * ✅ MCP Endpoint
 */
app.post("/mcp", async (req: Request, res: Response) => {
  const server = getServer();

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

/**
 * Optional: GET not allowed
 */
app.get("/mcp", (_req, res) =>
  res.status(405).set("Allow", "POST").send("Method Not Allowed")
);

const PORT = Number(process.env.PORT || 8787);

app.listen(PORT, () => {
  console.log(`🚀 Remote MCP running on port ${PORT}`);
});
