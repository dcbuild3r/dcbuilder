#!/usr/bin/env bun
import { runMcpServer } from "../mcp/server.ts";

await runMcpServer(Bun.env);
