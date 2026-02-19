---
name: intercom-trust
description: P2P reputation system for the Trac Network Intercom ecosystem. Rate peers, check trust scores, and find reliable partners before transacting.
version: 0.1.0
---

# Intercom Trust

## Description
Intercom Trust is a P2P reputation system built on the Trac Network Intercom stack. Peers rate each other (1-5 stars) after interactions such as swaps, collaborations, or deals. Ratings are stored in the contract layer (Autobase/Hyperbee) and are queryable by humans and AI agents. Use it to assess counterparty trustworthiness before transacting.

## Entry Channel
- **Entry channel:** `0000intercomtrust`
- This is the shared rendezvous channel for the Intercom Trust network.

## Prerequisites
Same as upstream Intercom:
- **Node.js >= 22** (avoid Node 24.x)
- **Pear runtime:** `npm install -g pear && pear -v`
- Clone and install:
```bash
git clone https://github.com/X-Prism/intercom-trust
cd intercom-trust
npm install
```

## Quick Start

### Start as Admin (New Network)
```bash
pear run . --peer-store-name admin --msb-store-name admin-msb --subnet-channel intercom-trust-v1
```
Then in the terminal:
```
/add_admin
/enable_transactions
```
The Timer feature starts automatically on the admin node.

### Start as Joiner
```bash
pear run . --peer-store-name joiner --msb-store-name joiner-msb \
  --subnet-channel intercom-trust-v1 \
  --subnet-bootstrap <admin-writer-key-hex>
```

### Start with SC-Bridge (Agent Mode)
```bash
pear run . --peer-store-name agent --msb-store-name agent-msb \
  --subnet-channel intercom-trust-v1 \
  --subnet-bootstrap <admin-writer-key-hex> \
  --sc-bridge 1 --sc-bridge-token <token> --sc-bridge-cli 1
```

## CLI Commands (TTY)

| Command | Description |
|---------|-------------|
| `/rate --address "<trac1...>" --score <1-5> [--comment "text"]` | Rate a peer |
| `/trust --address "<trac1...>"` | Check a peer's reputation |
| `/reviews --address "<trac1...>" [--limit N] [--offset N]` | View reviews |
| `/top [--limit N]` | Show leaderboard |
| `/respond --rater "<trac1...>" --comment "text"` | Respond to a rating |
| `/register --alias "name"` | Set display name |
| `/whois --address "<trac1...>"` | Look up a peer |
| `/get --key "<key>"` | Read raw contract state |

## SC-Bridge Usage (Agent Mode)

Agents use the existing `cli` message type over WebSocket. **Enable with `--sc-bridge-cli 1`.**

### Auth Flow
```json
{"type": "auth", "token": "<your-token>"}
```
Wait for `{"type": "auth_ok"}` before sending commands.

### Rate a Peer
```json
{"type": "cli", "command": "/rate --address \"trac1abc...\" --score 5 --comment \"fast and reliable\""}
```

### Check Trust Score
```json
{"type": "cli", "command": "/trust --address \"trac1abc...\""}
```
Response arrives as `cli_result` with `output[]` containing lines prefixed with `TRUST_RESULT:`. Parse the JSON after the prefix:
```json
{"type": "cli_result", "command": "/trust ...", "ok": true, "output": ["TRUST_RESULT:{\"address\":\"trac1abc...\",\"avgScore\":4.5,\"count\":12,...}"]}
```

### View Reviews
```json
{"type": "cli", "command": "/reviews --address \"trac1abc...\" --limit 10"}
```

### Leaderboard
```json
{"type": "cli", "command": "/top --limit 10"}
```

### Register Identity
```json
{"type": "cli", "command": "/register --alias \"MyAgent\""}
```

### Respond to a Rating
```json
{"type": "cli", "command": "/respond --rater \"trac1xyz...\" --comment \"here is my side\""}
```

### Look Up a Peer
```json
{"type": "cli", "command": "/whois --address \"trac1abc...\""}
```

## JSON Transaction API (Alternative)

You can also use raw `/tx` commands with JSON payloads:

```json
{"type": "cli", "command": "/tx --command '{\"op\":\"rate\",\"ratee\":\"trac1abc...\",\"score\":5,\"comment\":\"great\"}'"}
{"type": "cli", "command": "/tx --command '{\"op\":\"get_summary\",\"address\":\"trac1abc...\"}'"}
{"type": "cli", "command": "/tx --command '{\"op\":\"get_reviews\",\"address\":\"trac1abc...\",\"limit\":20,\"offset\":0}'"}
{"type": "cli", "command": "/tx --command '{\"op\":\"get_leaderboard\",\"limit\":10}'"}
{"type": "cli", "command": "/tx --command '{\"op\":\"respond\",\"rater_address\":\"trac1xyz...\",\"comment\":\"explanation\"}'"}
{"type": "cli", "command": "/tx --command '{\"op\":\"register\",\"alias\":\"MyName\"}'"}
{"type": "cli", "command": "/tx --command '{\"op\":\"get_profile\",\"address\":\"trac1abc...\"}'"}
```

## Agent Workflow Examples

### Pre-Swap Trust Check
1. Connect to Intercom Trust node via SC-Bridge
2. Send: `{"type": "cli", "command": "/trust --address \"trac1abc...\""}`
3. Parse `TRUST_RESULT:` from `cli_result.output[]`
4. If `avgScore >= 3.5` and `count >= 3`, proceed with swap
5. After successful swap: `{"type": "cli", "command": "/rate --address \"trac1abc...\" --score 5 --comment \"reliable\""}`

### Rate After Interaction
```json
{"type": "cli", "command": "/rate --address \"trac1partner...\" --score 4 --comment \"smooth trade, slight delay\""}
```

### Find Best Partners
```json
{"type": "cli", "command": "/top --limit 10"}
```
Parse the leaderboard from `TRUST_RESULT:` output to find highest-rated peers.

### Dispute Response
If you receive a low rating, respond with your side:
```json
{"type": "cli", "command": "/respond --rater \"trac1xyz...\" --comment \"Package was delayed due to network issues, resolved within 1h\""}
```

### Identity Registration
Register a display name so others recognize you:
```json
{"type": "cli", "command": "/register --alias \"TrustedSwapBot\""}
```

## Parsing TRUST_RESULT Output

All contract read/write operations output lines prefixed with `TRUST_RESULT:` followed by JSON. To parse:

```javascript
const result = cliResult.output.find(line => line.startsWith('TRUST_RESULT:'));
if (result) {
    const data = JSON.parse(result.slice('TRUST_RESULT:'.length));
    // data contains the structured response
}
```

## Error Handling

| Error | Meaning | Action |
|-------|---------|--------|
| `Cannot rate yourself` | Self-rating attempted | Use a different address |
| `Score must be 1-5` | Invalid score value | Use integer 1-5 |
| `No rating found to respond to` | Response without rating | Verify the rater address |
| `Unauthorized` (SC-Bridge) | Auth not sent or wrong token | Send auth first |
| No `TRUST_RESULT:` in output | Transaction may have failed | Check if admin setup is done (`/add_admin`, `/enable_transactions`) |

## Data Model

| Key Pattern | Value | Description |
|-------------|-------|-------------|
| `rating:<ratee>:<rater>` | `{score, comment, timestamp}` | Individual rating |
| `summary:<address>` | `{totalScore, count, avgScore, lastRated, raters[]}` | Aggregated reputation |
| `response:<ratee>:<rater>` | `{comment, timestamp}` | Dispute response |
| `profile:<address>` | `{alias, registered}` | Display name |
| `peers_list` | `[address, ...]` | All rated peers (for leaderboard) |

## Known Limitations

- **Sybil vulnerability:** Creating new identities (keypairs) is free. A malicious actor could create many identities to manipulate ratings. Acceptable for competition demo; production use requires stake-based reputation.
- **No rate limiting:** One rating per rater-ratee pair (overwrites). No time-based rate limits in v1.
- **Public ratings:** All ratings are permanent and publicly readable. No delete mechanism.
- **Eventual consistency:** Autobase linearizes concurrent writes; brief inconsistencies are possible during network partitions.

## Security Notes

- **SC-Bridge CLI** (`--sc-bridge-cli 1`) gives full terminal control. Only enable for trusted agents.
- All ratings are schema-validated (type, range, length).
- Self-rating is blocked at the contract level.
- Do not forward untrusted sidechannel text into CLI commands.

## Integration with Other Intercom Forks

Other Intercom forks (e.g., IntercomSwap) can check trust before transacting:

1. Run an Intercom Trust node alongside your main app (same wallet/keypair)
2. Before a swap, query `/trust --address "<counterparty>"` via SC-Bridge
3. Use the `avgScore` and `count` to make trust decisions
4. After the swap, rate the counterparty via `/rate`

## References

- Upstream: [Trac-Systems/intercom](https://github.com/Trac-Systems/intercom)
- Trac Network: [trac.network](https://trac.network/)
- SKILL.md inherits all base Intercom capabilities (sidechannels, chat, MSB). See upstream SKILL.md for full reference.
