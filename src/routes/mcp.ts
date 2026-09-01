import { Router, type Request, type Response } from "express";
import { MCP_PROTOCOL_VERSIONS } from "../lib/constants";
import { env } from "../lib/env";
import { wrap } from "../lib/asyncHandler";
import { dispatchRpc, type RpcContext } from "../lib/mcpServer";

/**
 * MCP Streamable HTTP endpoint. Mounted before session/passport/csrf — it never
 * touches cookies. Stateless: POST in, one JSON response out (no SSE, no sessions).
 */
export const mcpRouter = Router();

const SUPPORTED = new Set<string>(MCP_PROTOCOL_VERSIONS);

function originAllowed(origin: string | undefined): boolean {
  if (!origin) return true; // non-browser MCP clients omit Origin
  try {
    const host = new URL(origin).hostname;
    return host === new URL(env.PUBLIC_BASE_URL).hostname || host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

mcpRouter.post(
  "/",
  wrap(async (req: Request, res: Response) => {
    if (!originAllowed(req.get("origin"))) {
      res.status(403).json({ error: "Origin not allowed" });
      return;
    }
    const protocolVersion = req.get("mcp-protocol-version");
    if (protocolVersion && !SUPPORTED.has(protocolVersion)) {
      res.status(400).json({ error: `Unsupported MCP-Protocol-Version: ${protocolVersion}` });
      return;
    }

    const body: unknown = req.body;
    if (!body || typeof body !== "object") {
      res
        .status(400)
        .json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
      return;
    }

    const ctx: RpcContext = { ip: req.ip ?? "unknown" };

    if (Array.isArray(body)) {
      if (body.length === 0) {
        res
          .status(400)
          .json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Empty batch" } });
        return;
      }
      const out = (await Promise.all(body.map((m) => dispatchRpc(m, ctx)))).filter(
        (r): r is object => r !== null,
      );
      if (out.length === 0) {
        res.status(202).end();
        return;
      }
      res.json(out);
      return;
    }

    const result = await dispatchRpc(body, ctx);
    if (result === null) {
      res.status(202).end();
      return;
    }
    res.json(result);
  }),
);

function methodNotAllowed(_req: Request, res: Response): void {
  res.status(405).set("Allow", "POST").json({ error: "Use POST for the MCP endpoint" });
}

mcpRouter.get("/", methodNotAllowed);
mcpRouter.delete("/", methodNotAllowed);
