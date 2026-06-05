# dcbuilder

Bun-native CLI and local stdio MCP server for agents that read from and submit
to the `dcbuilder.dev` agent API.

The backend owns the API contract, auth, redaction, inbox workflow, approval
rules, admin UI, semantic indexing, and persistence. This package only talks to
HTTP endpoints. It does not query Postgres directly and does not store secrets.

## Install

```bash
bun install
```

The package is private and is not published yet.

## Credentials

By default, the CLI uses:

```bash
DCBUILDER_API_URL=https://dcbuilder.dev
```

For authenticated commands, set a token in the process environment:

```bash
export DCBUILDER_API_TOKEN="..."
```

If `DCBUILDER_API_TOKEN` is missing, local CLI runs fall back to 1Password CLI:

```bash
op read op://Agents/DCBUILDER_API_TOKEN/credential
```

Override the 1Password item reference when needed:

```bash
export DCBUILDER_1PASSWORD_TOKEN_REF="op://Vault/Item/field"
```

Tokens should stay in your shell, secret manager, or agent runtime environment.
Do not write API tokens into repo files or generated MCP config examples.

## CLI

Default output is JSON.

```bash
bun run src/bin/dcbuilder.ts schema
bun run src/bin/dcbuilder.ts news --limit 10
bun run src/bin/dcbuilder.ts news --since 7d --category portfolio
bun run src/bin/dcbuilder.ts jobs --tag zk --company "Acme" --remote --format table
bun run src/bin/dcbuilder.ts candidates --location Prague --availability open --format markdown
bun run src/bin/dcbuilder.ts query "remote zk jobs in Prague limit 5"
bun run src/bin/dcbuilder.ts query --payload '{"table":"investments","filters":{"limit":5}}'
```

Inbox workflow:

```bash
bun run src/bin/dcbuilder.ts inbox list
bun run src/bin/dcbuilder.ts inbox list --status pending --kind job
bun run src/bin/dcbuilder.ts inbox show inbox_123
bun run src/bin/dcbuilder.ts inbox comment inbox_123 --payload '{"body":"Looks good"}'
bun run src/bin/dcbuilder.ts inbox approve inbox_123 --payload '{"payload":{"title":"Final title"},"note":"ship it"}'
bun run src/bin/dcbuilder.ts inbox reject inbox_123 --payload '{"reason":"duplicate"}'
```

Submissions:

```bash
bun run src/bin/dcbuilder.ts submit job --payload '{"title":"Protocol engineer"}'
bun run src/bin/dcbuilder.ts submit candidate --payload '{"name":"Ada"}'
bun run src/bin/dcbuilder.ts submit message --payload '{"message":"General update"}'
```

Admin operations:

```bash
bun run src/bin/dcbuilder.ts invites create --payload '{"label":"Partner","allowedKinds":["job"]}'
bun run src/bin/dcbuilder.ts search refresh --payload '{"resource":"jobs"}'
```

Supported output formats:

```bash
--format json
--format table
--format markdown
```

Natural-language parsing is a local convenience layer. The CLI converts phrases
into structured filters or an allowlisted query DSL, then calls deterministic
API endpoints. Free-form prompts are not sent as the canonical API contract.

## Endpoint Mapping

| CLI/MCP capability | Endpoint |
| --- | --- |
| `schema` | `GET /api/agent/schema` |
| `news` | `GET /api/agent/news` |
| `jobs` | `GET /api/agent/jobs` |
| `candidates` | `GET /api/agent/candidates` |
| `query` | `POST /api/agent/query` |
| `inbox list` | `GET /api/agent/inbox` |
| `inbox show` | `GET /api/agent/inbox/:id` |
| `inbox comment` | `POST /api/agent/inbox/:id/comments` |
| `inbox approve` | `POST /api/agent/inbox/:id/approve` |
| `inbox reject` | `POST /api/agent/inbox/:id/reject` |
| `submit <kind>` | `POST /api/agent/submit/:kind` |
| `invites create` | `POST /api/agent/invites` |
| `search refresh` | `POST /api/agent/search/refresh` |

Read routes send both `Authorization: Bearer <token>` and `x-api-key: <token>`
using `DCBUILDER_API_TOKEN`; tokens still come only from the environment.

## MCP

Run the local stdio MCP server:

```bash
bun run src/bin/dcbuilder-mcp.ts
```

Example MCP client config shape:

```json
{
  "mcpServers": {
    "dcbuilder": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/dcbuilder/src/bin/dcbuilder-mcp.ts"],
      "env": {
        "DCBUILDER_API_URL": "${DCBUILDER_API_URL}",
        "DCBUILDER_API_TOKEN": "${DCBUILDER_API_TOKEN}"
      }
    }
  }
}
```

The MCP server exposes tools for:

- `dcbuilder_schema`
- `dcbuilder_news`
- `dcbuilder_jobs`
- `dcbuilder_candidates`
- `dcbuilder_query`
- `dcbuilder_inbox_list`
- `dcbuilder_inbox_show`
- `dcbuilder_inbox_comment`
- `dcbuilder_inbox_approve`
- `dcbuilder_inbox_reject`
- `dcbuilder_submit_job`
- `dcbuilder_submit_candidate`
- `dcbuilder_submit_message`
- `dcbuilder_create_invite`
- `dcbuilder_refresh_search`

## Development

```bash
bun test
bun run typecheck
```
