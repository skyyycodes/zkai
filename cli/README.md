# zkai-cli

Provider node management CLI for [ZKai](https://zkai-ether-og.vercel.app) — the verifiable AI inference marketplace on 0G chain.

This package installs the `zkai` command, which automates everything a provider needs: wallet setup, container lifecycle (Docker Compose), and on-chain registration against the ZKai contracts deployed on 0G mainnet.

## Install

```bash
pip install zkai-cli
```

## Quick start

Becoming a provider takes 4 commands:

```bash
# 1. Initial setup — prompts for an EVM private key, writes .env
zkai init

# 2. Start the provider (bridge + TDX-attested enclave)
zkai start

# 3. Verify it's running
zkai status

# 4. Register on-chain — your wallet becomes your provider ID
zkai register --model qwen2.5:1.5b --price 100
```

Your node is now discoverable by ZKai consumers. Every inference you serve pays you native 0G straight to your wallet.

## Commands

| Command | Purpose |
|---|---|
| `zkai init` | First-time setup wizard (wallet, .env, relay config). |
| `zkai start` | Bring up the provider containers via `docker compose`. |
| `zkai stop` | Stop and remove containers. |
| `zkai restart [service]` | Restart all or one of: `bridge`, `enclave`. |
| `zkai status` | Show container health, wallet sync, enclave state, dashboard URL. |
| `zkai logs [service]` | Tail logs from a service. |
| `zkai register` | Register the provider in the on-chain `ProviderRegistry`. |
| `zkai deregister` | Remove the provider from the on-chain registry. |
| `zkai info` | Print local provider metadata. |
| `zkai keys` | Print API key management info. |

Run `zkai --help` for the full reference.

## Requirements

- Linux machine with Docker Engine + Compose plugin (Docker Desktop on macOS works too).
- An EVM-compatible wallet with a small amount of native 0G for gas. Get testnet 0G from [faucet.0g.ai](https://faucet.0g.ai).
- A model you want to serve (`qwen2.5:1.5b` is the default; any Ollama model works).

## How it fits together

ZKai providers run two containers:

- **bridge** — Node.js sidecar that wraps `ethers.js` and talks to 0G chain on your behalf. Registers, attests, and accepts payment.
- **enclave** — Python/FastAPI service running inside a Gramine TDX-sealed runtime, serving an OpenAI-compatible inference endpoint.

The CLI hides all of this behind a few commands. Edit `provider/.env` if you need to override the model, gateway URL, or relay endpoint.

## Links

- Repository — https://github.com/skyyycodes/zkai-eth
- Dashboard — https://zkai-ether-og.vercel.app
- 0G chain explorer — https://chainscan.0g.ai

## License

MIT
