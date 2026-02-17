import express, { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import * as z from "zod";

// ✅ Create MCP server
const getServer = () => {
  const server = new McpServer(
    { name: "marketing-mcp", version: "1.0.0" },
    { capabilities: { tools: {}, logging: {} } }
  );

  // ✅ Test tool (we’ll replace with Meta + GA4 tools later)
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
        content: [{ type: "text", text: `✅ Remote MCP working. You said: ${message}` }],
      };
    }
  );

  return server;
};

// ✅ Express app with protection (good practice)
const app = createMcpExpressApp();
app.use(express.json());

// ✅ MCP endpoint (IMPORTANT: /mcp)
app.post("/mcp", async (req: Request, res: Response) => {
  const server = getServer();

  try {
    // Stateless: no session storage (simple + good for start)
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
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// Optional: GET /mcp not supported → 405 (ok)
app.get("/mcp", (_req, res) => res.status(405).set("Allow", "POST").send("Method Not Allowed"));

const PORT = Number(process.env.PORT || 8787);
app.listen(PORT, () => console.log(`🚀 Remote MCP running: http://localhost:${PORT}/mcp`));
