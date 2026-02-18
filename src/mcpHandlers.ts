import { findTool, listToolDefinitions } from "./tools";

export type JsonRpcRequest = {
  jsonrpc?: "2.0";
  id?: string | number | null;
  method: string;
  params?: any;
};

export type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: string | number | null; result: any }
  | { jsonrpc: "2.0"; id: string | number | null; error: { code: number; message: string; data?: any } };

function ok(id: any, result: any): JsonRpcResponse {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function err(id: any, code: number, message: string, data?: any): JsonRpcResponse {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message, data } };
}

export async function handleJsonRpc(req: JsonRpcRequest): Promise<JsonRpcResponse> {
  const id = req.id ?? null;

  try {
    if (!req.method) return err(id, -32600, "Invalid Request: missing method");

    if (req.method === "tools/list") {
      return ok(id, { tools: listToolDefinitions() });
    }

    if (req.method === "tools/call") {
      const toolName = req.params?.name;
      const args = req.params?.arguments ?? {};

      if (typeof toolName !== "string" || !toolName.trim()) {
        return err(id, -32602, "Invalid params: 'name' is required");
      }

      const tool = findTool(toolName.trim());
      if (!tool) return err(id, -32601, `Tool not found: ${toolName}`);

      const result = await tool.handler(args);
      return ok(id, result);
    }

    return err(id, -32601, `Method not found: ${req.method}`);
  } catch (e: any) {
    return err(id, -32000, "Server error", { message: e?.message ?? String(e) });
  }
}
