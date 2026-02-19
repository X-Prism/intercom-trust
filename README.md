# Intercom Trust

A **P2P reputation system** for the [Trac Network](https://trac.network/) Intercom ecosystem. Peers rate each other (1-5 stars) after interactions, with ratings stored in the contract layer (Autobase/Hyperbee). AI agents and humans can query reputation scores before transacting.

**Trac Address:** `trac17mvnwaah0wuj20dyr2kcw8muuggy7k4wchc8k47hmpdxtre7x7hq6wxpm8`

## Features

- **Rate peers** \u2014 1-5 star ratings with optional comments (280 chars)
- **Trust scores** \u2014 pre-computed averages, queryable by address
- **Reviews** \u2014 paginated review list with dispute responses
- **Leaderboard** \u2014 top peers sorted by reputation
- **Profiles** \u2014 register display names
- **Agent-ready** \u2014 all operations available via SC-Bridge WebSocket
- **Self-rating prevention** \u2014 enforced at the contract level
- **One rating per pair** \u2014 updates overwrite cleanly

## Quick Start

**Prerequisites:** Node.js >= 22, Pear runtime (`npm install -g pear && pear -v`)

```bash
git clone https://github.com/X-Prism/intercom-trust
cd intercom-trust
npm install

# Start as admin (new network)
pear run . --peer-store-name admin --msb-store-name admin-msb --subnet-channel intercom-trust-v1
```

Then in the terminal:
```
/add_admin
/enable_transactions
/register --alias "MyName"
/rate --address "trac1..." --score 5 --comment "great peer"
/trust --address "trac1..."
/top
```

For full documentation, see **[SKILL.md](SKILL.md)**.

## CLI Commands

| Command | Description |
|---------|-------------|
| `/rate --address "<addr>" --score <1-5> [--comment "..."]` | Rate a peer |
| `/trust --address "<addr>"` | Check reputation |
| `/reviews --address "<addr>"` | View reviews |
| `/top [--limit N]` | Leaderboard |
| `/respond --rater "<addr>" --comment "..."` | Dispute response |
| `/register --alias "name"` | Set display name |
| `/whois --address "<addr>"` | Peer lookup |

## Agent Usage (SC-Bridge)

Start with `--sc-bridge 1 --sc-bridge-token <token> --sc-bridge-cli 1`, then over WebSocket:

```json
{"type": "auth", "token": "<token>"}
{"type": "cli", "command": "/trust --address \"trac1abc...\""}
{"type": "cli", "command": "/rate --address \"trac1abc...\" --score 5 --comment \"reliable\""}
```

Contract output is prefixed with `TRUST_RESULT:` for reliable parsing.

## Known Limitations

- **Sybil:** Free identity creation means ratings can be gamed. Acceptable for demo; v2 could add stake-based reputation.
- **Public data:** All ratings are permanent and publicly readable.
- **Eventual consistency:** Autobase linearizes concurrent writes; brief inconsistencies possible during partitions.

## Built On

- [Trac-Systems/intercom](https://github.com/Trac-Systems/intercom) \u2014 upstream Intercom stack
- [trac-peer](https://github.com/Trac-Systems/trac-peer) \u2014 P2P runtime
- [Autobase/Hyperbee](https://docs.holepunch.to/) \u2014 replicated state

## License

See [LICENSE.md](LICENSE.md)
