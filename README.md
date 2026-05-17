# ZKai

> **Verifiable AI inference. Encrypted client-side. Sealed in TEEs. Settled on 0G chain.**

[![PyPI - SDK](https://img.shields.io/pypi/v/zkai?label=zkai%20SDK&color=cyan)](https://pypi.org/project/zkai/)
[![PyPI - CLI](https://img.shields.io/pypi/v/zkai-cli?label=zkai-cli&color=cyan)](https://pypi.org/project/zkai-cli/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/Live-zkai--ether--og.vercel.app-black?logo=vercel)](https://zkai-ether-og.vercel.app)
[![0G Mainnet](https://img.shields.io/badge/Deployed-0G%20Mainnet-cyan)](https://chainscan.0g.ai)

ZKai is a decentralized AI inference marketplace where every response is cryptographically verified. Consumers send OpenAI-compatible requests through a hosted gateway; providers run inference inside Intel TDX-sealed enclaves. Every prompt is encrypted client-side with the enclave's TDX-attested public key — the gateway never sees plaintext. Every completed inference produces a SHA-256 attestation hash anchored on **0G Mainnet**. The result: private inference, verifiable billing, native A0GI payments, and a familiar developer API.

---

## Table of Contents

1. [Why ZKai](#why-zkai)
2. [Live System](#live-system)
3. [Quick Start — Consumers](#quick-start--consumers)
4. [Quick Start — Providers](#quick-start--providers)
5. [Architecture](#architecture)
6. [Request Lifecycle](#request-lifecycle)
7. [End-to-End Encryption](#end-to-end-encryption)
8. [Smart Contracts (0G Mainnet)](#smart-contracts-0g-mainnet)
9. [Repository Layout](#repository-layout)
10. [Development Setup](#development-setup)
11. [Deploying Contracts](#deploying-contracts)
12. [Frontend Development](#frontend-development)
13. [SDK Reference](#sdk-reference)
14. [CLI Reference](#cli-reference)
15. [Security Model](#security-model)
16. [Troubleshooting](#troubleshooting)
17. [Roadmap](#roadmap)
18. [Contributing](#contributing)
19. [License](#license)

---

## Why ZKai

Every AI API today runs on trust:

- You can't verify which model actually ran your prompt.
- You can't prove the provider didn't log it.
- You can't tell if a cheaper model was silently substituted.

ZKai replaces that trust with proof:

| Layer | What it gives you |
|---|---|
| **End-to-end encryption** | Prompts are encrypted client-side with the enclave's X25519 key. The gateway sees only ciphertext. |
| **TDX-sealed execution** | Models run inside Intel TDX enclaves. The host operator cannot read memory, cannot tamper with execution. |
| **On-chain attestation** | Every inference emits a SHA-256 hash committing to the model, prompt, and response. Anchored permanently on 0G Mainnet. |
| **Native settlement** | Payment escrows in 0G. Per-inference micropayments at sub-cent gas. No bridges, no wrapped tokens. |
| **OpenAI-compatible** | Existing OpenAI client code drops in by changing the base URL. Two-line integration. |

---

## Live System

| | |
|---|---|
| **Frontend / Gateway** | https://zkai-ether-og.vercel.app |
| **Dashboard** | https://zkai-ether-og.vercel.app/dashboard |
| **Pitch Deck** | https://zkai-ether-og.vercel.app/deck |
| **WebSocket Relay** | https://zkai-relay.fly.dev |
| **Block Explorer** | https://chainscan.0g.ai |
| **Faucet (testnet)** | https://faucet.0g.ai |

---

## Quick Start — Consumers

You want to call AI models through ZKai. End-to-end encrypted, attested, billed in 0G.

### Install

```bash
pip install zkai
```

### Use

```python
from zkai import ZKai

client = ZKai(api_key="zkai-...")  # get one at https://zkai-ether-og.vercel.app/dashboard

response = client.chat.completions.create(
    model="qwen2.5:1.5b",
    messages=[{"role": "user", "content": "Explain verifiable inference in one sentence."}],
)

print(response.choices[0].message.content)
print("On-chain receipt:", response.attestation_hash)
```

What happens behind the scenes:

1. SDK fetches the enclave's X25519 public key from the gateway.
2. SDK encrypts your prompt locally with ECDH + ChaCha20-Poly1305.
3. Only ciphertext travels over the wire.
4. The TDX enclave decrypts inside sealed memory, runs the model, encrypts the response with the same session key.
5. Attestation hash gets anchored on 0G chain.
6. SDK decrypts the response locally.

The gateway never sees plaintext.

### Top up your escrow

Before you can run inferences, deposit some A0GI to the [PaymentEscrow contract](https://chainscan.0g.ai/address/0xb2C7c0F7a4C2877319E8Ed1Fae0bf3C705b6Fc4C):

1. Visit [the dashboard](https://zkai-ether-og.vercel.app/dashboard)
2. Connect MetaMask (it auto-switches you to 0G Mainnet)
3. Go to **Credits** → enter an amount → click **Deposit AOGI**

Every inference auto-deducts from this balance. No per-call MetaMask popups.

### Generate an API key

In the dashboard, go to **API Keys**, click **+ Create Key**, name it, copy it once. It's tied to your wallet.

---

## Quick Start — Providers

You have a GPU (or even just CPU) and want to earn A0GI by serving inference.

### Prerequisites

- Linux box (Ubuntu 22.04+ recommended) or macOS with Docker Desktop
- **Docker Engine 24+** with the Compose plugin
- **Python 3.9+**
- An **EVM private key** (e.g. from MetaMask → Account → Export Private Key, or `cast wallet new` from Foundry)
- A small balance of native **0G** on Mainnet (~1 0G is more than enough for setup + months of operation)

### One-time setup

```bash
pip install zkai-cli
zkai init
```

`zkai init` will:
1. Download the runtime tarball from the matching [GitHub Release](https://github.com/skyyycodes/zkai/releases) to `~/.zkai/`
2. Fetch relay configuration from the gateway
3. Prompt you to paste your EVM private key
4. Write `~/.zkai/provider/.env` with all the config

### Boot the node

```bash
zkai start
zkai status
```

You should see:
```
zkai-bridge   running   healthy
zkai-enclave  running

Bridge: synced  |  address: 0xYOUR_ADDR  |  chain: 0G Mainnet
Enclave: ok    |  mode: direct
```

### Register on-chain

```bash
zkai register --model qwen2.5:1.5b --price 100
```

This fires a `register()` tx on the [ProviderRegistry contract](https://chainscan.0g.ai/address/0x6D400F5D1DcCaA3e98E3dE17322aA23DE38bAC99), and also notifies the gateway DB so consumers can discover you.

### Verify you're live

```bash
zkai status        # shows your provider dashboard URL
zkai logs bridge   # tail the bridge for incoming attestations
```

Open `https://zkai-ether-og.vercel.app/provider_dashboard?id=0xYOUR_ADDR` to see your earnings.

### Day-to-day operations

| Command | Purpose |
|---|---|
| `zkai start` / `zkai stop` / `zkai restart` | Lifecycle |
| `zkai status` | Container health + wallet + dashboard URL |
| `zkai logs [bridge\|enclave]` | Tail logs |
| `zkai info` | Print provider ID, pubkey, endpoint, price |
| `zkai register` | Update on-chain registration (also re-runs after price changes) |
| `zkai deregister` | Remove from registry |

---

## Architecture

```
┌──────────┐  encrypted prompt   ┌─────────┐  WSS  ┌────────┐  WS   ┌──────────────┐
│ Consumer │ ──────────────────▶ │ Gateway │ ────▶ │ Relay  │ ────▶ │ Provider Node│
│   SDK    │ ◀────────────────── │ Vercel  │ ◀──── │ Fly.io │ ◀──── │ ┌──────────┐ │
└──────────┘   encrypted reply   └─────────┘       └────────┘       │ │  Bridge  │ │
                                      │                              │ │ (ethers) │ │
                                      │                              │ └──────────┘ │
                                      │                              │ ┌──────────┐ │
                                      │                              │ │ Enclave  │ │
                                      │                              │ │  TDX +   │ │
                                      │                              │ │  Ollama  │ │
                                      ▼                              │ └──────────┘ │
                              ┌──────────────────────────┐           └──────┬───────┘
                              │ Neon Postgres            │                  │
                              │ (API keys, jobs, providers) │                  │
                              └──────────────────────────┘                  │
                                      ▲                                     │
                                      │ register()                          │
                                      │ deductBalance()        ┌────────────┴──────────┐
                                      │ postAttestation()      │  0G Mainnet (16661)   │
                                      └────────────────────────┤  ProviderRegistry     │
                                                               │  PaymentEscrow        │
                                                               │  AttestationRegistry  │
                                                               └───────────────────────┘
```

### Components

| Component | Stack | Purpose |
|---|---|---|
| **SDK** (`sdk/`) | Python | OpenAI-compatible client. Handles client-side encryption + attestation parsing. |
| **CLI** (`cli/`) | Python (Typer + Rich) | Provider node manager: install, init, start, register. |
| **Gateway** (`frontend/`) | Next.js 16 on Vercel | API key auth, provider routing, encrypted-chat passthrough, dashboard UI. |
| **Relay** (`relay/`) | Node.js + WS on Fly.io | Bridges public HTTP requests to providers behind NAT via outbound WebSockets. |
| **Bridge** (`bridge/`) | Node.js + ethers v6 | Provider-side service that talks to 0G chain (register, deductBalance, postAttestation). |
| **Enclave** (`provider/`) | Python/FastAPI + Ollama + Gramine TDX | Runs inference inside a TDX-sealed runtime. Exposes `/pubkey` and `/infer`. |
| **Contracts** (`contracts/`) | Solidity 0.8.20 | ProviderRegistry, PaymentEscrow, AttestationRegistry. |
| **Deploy** (`deploy/`) | Hardhat + TypeScript | Compile + deploy contracts, generate ABIs. |

---

## Request Lifecycle

When a consumer calls `client.chat.completions.create(...)`:

1. **Fetch enclave pubkey** — SDK calls `GET /api/providers/pubkey?model=qwen2.5:1.5b`. The gateway picks a registered provider and asks for the enclave's X25519 pubkey via the relay.
2. **Encrypt locally** — SDK generates an ephemeral X25519 keypair, derives a shared secret via ECDH with the enclave's pubkey, encrypts the prompt with ChaCha20-Poly1305.
3. **Send ciphertext** — SDK POSTs `{provider_id, client_pubkey, encrypted_prompt}` to `/api/v1/encrypted-chat`.
4. **Gateway forwards** — Gateway verifies the API key against the DB and pipes the opaque blob to the provider's `/infer` endpoint over the relay's WebSocket.
5. **Enclave decrypts + runs** — Inside the TDX-sealed memory region, the enclave derives the same shared secret, decrypts the prompt, runs the model (Ollama), encrypts the response with the same session key, and computes the SHA-256 attestation hash.
6. **Asynchronous settlement** — In parallel, the provider's bridge fires `postAttestation(jobId, hash)` and `deductBalance(consumer, provider, jobId, amount)` on 0G Mainnet.
7. **Response decrypts client-side** — SDK decrypts using the shared secret it already has.
8. **Attestation visible on-chain** — `https://chainscan.0g.ai/tx/<hash>` shows the immutable receipt.

---

## End-to-End Encryption

The encryption story matters because most "private AI" claims are just TLS.

### Threat model

| Adversary | What they see | What they can't | Mitigation |
|---|---|---|---|
| Network observer | TLS-wrapped ciphertext | Anything | TLS 1.3 |
| Gateway operator (us) | Encrypted blob, API key, token count | Prompt, response | Client-side ECDH + ChaCha20-Poly1305 |
| Relay operator | Encrypted blob | Prompt, response, API key | Same |
| Provider host OS / root | Encrypted memory regions | Prompt, response, model weights, session key | Intel TDX |
| Compromised TDX (extreme case) | Everything, this one request | History of past inferences | On-chain attestation history |
| On-chain observer | Job IDs, attestation hashes, payment flows | Prompt content, response content | Public chain only stores hashes |

### Crypto primitives

- **Key exchange**: X25519 (Curve25519 ECDH)
- **Key derivation**: SHA-256 of shared secret (placeholder for future HKDF)
- **Symmetric cipher**: ChaCha20-Poly1305 with 12-byte nonce
- **Attestation hash**: SHA-256

Implementation: [`sdk/zkai/crypto.py`](sdk/zkai/crypto.py) (Python), matching enclave code in [`provider/api/enclave.py`](provider/api/enclave.py).

---

## Smart Contracts (0G Mainnet)

| Contract | Address | Source |
|---|---|---|
| **ProviderRegistry** | [`0x6D400F5D1DcCaA3e98E3dE17322aA23DE38bAC99`](https://chainscan.0g.ai/address/0x6D400F5D1DcCaA3e98E3dE17322aA23DE38bAC99) | [contracts/src/ProviderRegistry.sol](contracts/src/ProviderRegistry.sol) |
| **PaymentEscrow** | [`0xb2C7c0F7a4C2877319E8Ed1Fae0bf3C705b6Fc4C`](https://chainscan.0g.ai/address/0xb2C7c0F7a4C2877319E8Ed1Fae0bf3C705b6Fc4C) | [contracts/src/PaymentEscrow.sol](contracts/src/PaymentEscrow.sol) |
| **AttestationRegistry** | [`0x8c8Ae0A113084268D181fd1cf23d611DC2EAa2B2`](https://chainscan.0g.ai/address/0x8c8Ae0A113084268D181fd1cf23d611DC2EAa2B2) | [contracts/src/AttestationRegistry.sol](contracts/src/AttestationRegistry.sol) |

### Network parameters

| | Mainnet | Testnet (Galileo) |
|---|---|---|
| Chain ID | `16661` | `16602` |
| RPC | `https://evmrpc.0g.ai` | `https://evmrpc-testnet.0g.ai` |
| Explorer | `https://chainscan.0g.ai` | `https://chainscan-galileo.0g.ai` |
| Native token | `0G` | `A0GI` |
| Faucet | — | `https://faucet.0g.ai` |

### Contract interfaces

**PaymentEscrow** — native A0GI escrow with auto-deduct.

```solidity
function deposit() external payable;
function withdraw(uint256 amount) external;
function balance(address user) external view returns (uint256);

function deductBalance(
    address walletAddr,
    address providerId,
    bytes32 jobId,
    uint256 amount
) external;

event Deposited(address indexed user, uint256 amount);
event Deducted(bytes32 indexed jobId, address indexed wallet, address indexed provider, uint256 amount);
event Withdrawn(address indexed user, uint256 amount);
```

**ProviderRegistry** — provider directory.

```solidity
function register(string calldata endpoint, string calldata model, uint256 pricePerToken) external;
function deregister() external;
function getActiveProviders() external view returns (address[] memory);
function providers(address) external view returns (
    string memory endpoint,
    string memory model,
    uint256 pricePerToken,
    bool active
);
```

**AttestationRegistry** — immutable inference receipts.

```solidity
function postAttestation(bytes32 jobId, bytes32 attestationHash) external;
function attestations(bytes32 jobId) external view returns (bytes32);

event AttestationPosted(bytes32 indexed jobId, bytes32 attestationHash);
```

### Gas costs (observed on 0G Mainnet at ~4 gwei)

| Operation | Gas | Cost in 0G |
|---|---|---|
| Deploy all 3 contracts | ~1.4M | ~0.006 |
| `register()` | ~150k | ~0.0006 |
| `deposit()` | ~50k | ~0.0002 |
| `deductBalance()` | ~80k | ~0.0003 |
| `postAttestation()` | ~50k | ~0.0002 |
| `withdraw()` | ~30k | ~0.0001 |

Per-inference settlement cost: **~$0.0005** at $1 per 0G. Comfortably below most gross margins.

---

## Repository Layout

```
zkai/
├── contracts/              # Solidity sources
│   └── src/
│       ├── ProviderRegistry.sol
│       ├── PaymentEscrow.sol
│       └── AttestationRegistry.sol
│
├── deploy/                 # Hardhat — compile & deploy contracts
│   ├── contracts/          # Mirror of contracts/src (Hardhat looks here)
│   ├── scripts/deploy.ts
│   ├── hardhat.config.ts
│   ├── deployment.json     # Live mainnet addresses (committed)
│   └── abis/               # JSON ABIs for bridge + frontend
│
├── sdk/                    # Python SDK (PyPI: zkai)
│   ├── zkai/
│   │   ├── client.py       # OpenAI-compatible interface
│   │   ├── crypto.py       # X25519 + ChaCha20-Poly1305
│   │   ├── provider.py     # Provider discovery
│   │   ├── attestation.py  # On-chain hash verification
│   │   └── langchain.py    # LangChain adapter
│   └── pyproject.toml
│
├── cli/                    # Provider CLI (PyPI: zkai-cli)
│   ├── zkai_cli/
│   │   ├── main.py         # Typer app
│   │   ├── setup.py        # `zkai init`
│   │   ├── docker.py       # `zkai start/stop/restart/logs/status`
│   │   ├── register.py     # `zkai register/deregister/info`
│   │   └── util.py         # Runtime tarball downloader
│   └── pyproject.toml
│
├── bridge/                 # Provider-side Node.js sidecar
│   └── src/
│       ├── server.ts       # Fastify HTTP server
│       ├── wallet.ts       # ethers Wallet (EVM signer)
│       ├── contracts.ts    # ethers.Contract bindings
│       └── routes/
│           ├── payment.ts
│           ├── registry.ts
│           └── attestation.ts
│
├── provider/               # Docker Compose runtime + enclave
│   ├── docker-compose.yml
│   ├── Dockerfile          # Gramine + Python + Ollama
│   ├── api/
│   │   ├── main.py         # FastAPI: /pubkey, /infer, /v1/chat/completions
│   │   ├── enclave.py      # X25519 keygen, decrypt, encrypt
│   │   └── ws_relay_client.py  # outbound WS to relay
│   └── llama.manifest.template
│
├── relay/                  # Fly.io WebSocket relay
│   ├── index.js
│   ├── Dockerfile
│   └── fly.toml
│
└── frontend/               # Next.js gateway + dashboard
    ├── app/
    │   ├── page.tsx        # Landing
    │   ├── dashboard/      # Consumer dashboard
    │   ├── deck/           # Pitch deck (/deck)
    │   ├── provider_dashboard/
    │   └── api/
    │       ├── providers/pubkey/    # NEW — enclave pubkey lookup
    │       ├── v1/encrypted-chat/   # NEW — encrypted inference route
    │       ├── v1/chat/completions/ # Legacy plaintext route
    │       ├── escrow/
    │       └── auth/
    └── lib/
        ├── wallet.ts       # MetaMask via EIP-6963
        └── escrow.ts       # PaymentEscrow contract bindings
```

---

## Development Setup

### Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 22+ | Use `nvm` or system package manager |
| Python | 3.11+ | For SDK + CLI work |
| Docker | 24+ with Compose | Required for provider containers |
| Hardhat | via npm | Installed by `deploy/package.json` |
| MetaMask | latest | For frontend testing |

### Clone

```bash
git clone https://github.com/skyyycodes/zkai.git
cd zkai
```

### Install workspaces

```bash
# Contracts
cd deploy && npm install && cd ..

# Bridge
cd bridge && npm install && cd ..

# Relay
cd relay && npm install && cd ..

# Frontend
cd frontend && npm install && cd ..

# SDK (editable)
pip install -e sdk

# CLI (editable)
pip install -e cli
```

---

## Deploying Contracts

> Already deployed on 0G Mainnet. You only need this if you're forking or moving to another EVM chain.

```bash
cd deploy
export ZKAI_PRIVATE_KEY=0x<your-deployer-key>

# Mainnet
npx hardhat run scripts/deploy.ts --network mainnet

# Testnet (Galileo)
npx hardhat run scripts/deploy.ts --network galileo
```

The script writes new addresses to `deploy/deployment.json` and ABIs to `deploy/abis/`. The bridge and frontend pick them up from there automatically.

---

## Frontend Development

```bash
cd frontend
npm run dev    # http://localhost:3000
```

### Required env vars (`frontend/.env.local`)

```bash
# Public — exposed to the browser
NEXT_PUBLIC_REGISTRY_CONTRACT=0x6D400F5D1DcCaA3e98E3dE17322aA23DE38bAC99
NEXT_PUBLIC_ESCROW_CONTRACT=0xb2C7c0F7a4C2877319E8Ed1Fae0bf3C705b6Fc4C
NEXT_PUBLIC_ATTESTATION_CONTRACT=0x8c8Ae0A113084268D181fd1cf23d611DC2EAa2B2

# Server-only
OG_RPC_URL=https://evmrpc.0g.ai
DATABASE_URL=postgresql://...           # Neon Postgres URL
ZKAI_RELAY_URL=https://zkai-relay.fly.dev
ZKAI_RELAY_SECRET=<shared-secret>
ZKAI_AUTH_URL=https://zkai-ether-og.vercel.app
```

### Deploy to Vercel

```bash
cd frontend
npx vercel --prod
```

Set the same env vars in the Vercel dashboard under **Settings → Environment Variables**.

---

## SDK Reference

### Initialization

```python
from zkai import ZKai

client = ZKai(
    api_key="zkai-...",                              # required for hosted gateway
    base_url="https://zkai-ether-og.vercel.app",     # default
    encrypted=True,                                    # default; False uses legacy plaintext path
    provider_endpoint=None,                            # set to bypass gateway and hit a specific provider
    skip_attestation=False,                            # dev only — never disable in prod
)
```

### Chat completion (drop-in OpenAI)

```python
response = client.chat.completions.create(
    model="qwen2.5:1.5b",
    messages=[
        {"role": "system", "content": "You answer concisely."},
        {"role": "user", "content": "What's 2 + 2?"},
    ],
)

response.choices[0].message.content   # "4"
response.choices[0].finish_reason     # "stop"
response.usage.prompt_tokens          # int
response.usage.completion_tokens      # int
response.attestation_hash             # ZKai-specific: on-chain receipt
```

### LangChain adapter

```bash
pip install "zkai[langchain]"
```

```python
from zkai.langchain import ChatZKai
from langchain_core.messages import HumanMessage

llm = ChatZKai(api_key="zkai-...", model="qwen2.5:1.5b")
llm.invoke([HumanMessage("Hello")])
```

### Direct provider mode (advanced)

Bypass the gateway and hit a specific provider directly. Useful for self-hosted deployments.

```python
client = ZKai(
    api_key="zkai-...",
    provider_endpoint="http://192.168.1.10:8080",
    skip_attestation=False,
)
```

---

## CLI Reference

### Install

```bash
pip install zkai-cli
```

### Commands

```
zkai init        # First-time setup wizard (writes ~/.zkai/provider/.env)
zkai start       # docker compose up -d
zkai stop        # docker compose down
zkai restart     # restart [bridge|enclave|both]
zkai logs        # tail -f [bridge|enclave|both]
zkai status      # container + wallet + chain + dashboard URL
zkai register    # on-chain register (one-time or after price change)
zkai deregister  # remove from on-chain registry
zkai info        # print local provider metadata
zkai keys        # info about API keys (managed via dashboard)
```

All commands accept `--dir /path/to/runtime` to override the auto-detect default `~/.zkai`.

### Where things live

| Path | Purpose |
|---|---|
| `~/.zkai/` | Runtime root (extracted from GitHub Release tarball) |
| `~/.zkai/provider/.env` | Provider config (private key, model, prices) |
| `~/.zkai/provider/.provider_id` | Saved metadata after `zkai register` |
| `~/.zkai/bridge/providers.json` | Local provider cache (auto-managed) |

---

## Security Model

### What's protected

- **Prompt confidentiality** — encrypted client-side with the enclave's TDX-attested key. Gateway, relay, and host OS cannot read it.
- **Response confidentiality** — encrypted with the same ephemeral session key, only the original client can decrypt.
- **Inference integrity** — TDX hardware isolation + on-chain attestation hash makes silent model substitution detectable.
- **Payment integrity** — escrow contract enforces atomic debit-and-credit, no off-chain trust required.

### What's NOT protected (yet)

- **Metadata** — token counts, timestamps, API key, model name are visible to the gateway for billing and routing.
- **Provider model authenticity** — we hash the model weights into the attestation, but verifying the canonical hash off-chain is still manual.
- **Side-channel attacks on TDX** — Intel TDX is newer than SGX (no Foreshadow/SGAxe class of issues yet), but no TEE is unbreakable. Layered defense via on-chain attestation history.

### Known limitations

- The bridge's EVM private key lives in plaintext in `~/.zkai/provider/.env`. Use a dedicated, low-balance hot wallet — never your main wallet.
- API key verification at the enclave currently piggybacks on the central gateway DB (Neon). A fully decentralized model would have providers verify keys against on-chain registry, future work.

---

## Troubleshooting

### `zkai status` shows bridge unhealthy

```bash
zkai logs bridge | head -50
```

Common causes:
- **`Wallet init failed: ZKAI_PRIVATE_KEY required`** → re-run `zkai init`
- **`insufficient funds for gas`** → fund your wallet with 0G
- **Network errors hitting `evmrpc.0g.ai`** → check internet, or override with `OG_RPC_URL` in `~/.zkai/provider/.env`

### `zkai register` fails

- Make sure `zkai status` shows synced first.
- Check `zkai logs bridge` for the actual transaction error.
- Most common: not enough native 0G in the bridge wallet. Need ~0.001 0G for the tx.

### Consumer SDK errors

```python
# Re-raise the full exception
import traceback
try:
    response = client.chat.completions.create(...)
except Exception as e:
    traceback.print_exc()
```

Common errors:
- `ZKaiAuthError` — invalid or revoked API key
- `ZKaiNoProviderError` — no provider available for the requested model
- `HTTPError 502` — provider unreachable (relay disconnected, enclave down)

### Relay says `"providers": 0` but enclave is running

The enclave's outbound WebSocket may have stalled. Restart the enclave:

```bash
zkai restart enclave
```

Wait ~10 seconds, then check `curl -s https://zkai-relay.fly.dev/health`.

### MetaMask connection issues on the dashboard

If MetaMask shows the wrong network or no balance:
- Click MetaMask network dropdown → "0G Mainnet"
- If not listed, the dapp will offer to add it on connect (chain ID 16661, RPC `https://evmrpc.0g.ai`)
- If Core Wallet or another EVM wallet is also installed, the dapp uses EIP-6963 to find MetaMask explicitly

### Deposit shows "missing revert data"

Usually means MetaMask is on the wrong chain. Switch to **0G Mainnet (16661)** and retry. If the wallet shows zero native balance, the deposit will revert because `require(msg.value > 0)`.

---

## Roadmap

- [x] OpenAI-compatible SDK
- [x] Solidity contracts on 0G Mainnet
- [x] MetaMask + ethers v6 frontend
- [x] End-to-end encryption (client → enclave)
- [x] On-chain attestation per inference
- [x] Provider CLI (`pip install zkai-cli`)
- [x] WebSocket relay for NAT'd providers
- [ ] Integrate with 0G Compute Network as a provider source
- [ ] ZK-style attestations (in addition to TDX) for model-class proofs
- [ ] iNFT representation of providers (ERC-7857) for tradable inference capacity
- [ ] Streaming responses over the encrypted channel
- [ ] Multi-region relay clusters
- [ ] Browser-native SDK (TypeScript) for in-app inference without a Python dependency

---

## Contributing

PRs welcome. The codebase is intentionally small and single-purpose; if you're adding a feature, please open an issue first to discuss fit.

### Useful PR ideas

- Streaming SSE response support in `frontend/app/api/v1/encrypted-chat/route.ts`
- TypeScript SDK port of `sdk/zkai`
- Provider-side benchmarking + reputation hooks in `bridge/src/routes/registry.ts`
- More model presets in `provider/docker-compose.yml`
- Cross-chain attestation mirror (Ethereum L1 + LayerZero / CCIP)

### Local testing checklist before opening a PR

```bash
# Contracts compile cleanly
cd deploy && npx hardhat compile

# Bridge type-checks
cd bridge && npx tsc --noEmit

# Frontend builds
cd frontend && npm run build

# SDK imports work
python -c "from zkai import ZKai; print('OK')"
```

---

## Links

- **Live demo** — https://zkai-ether-og.vercel.app
- **Pitch deck** — https://zkai-ether-og.vercel.app/deck
- **SDK on PyPI** — https://pypi.org/project/zkai/
- **CLI on PyPI** — https://pypi.org/project/zkai-cli/
- **GitHub** — https://github.com/skyyycodes/zkai
- **Releases** — https://github.com/skyyycodes/zkai/releases
- **0G chain docs** — https://docs.0g.ai

---

## License

MIT — see [LICENSE](LICENSE).
