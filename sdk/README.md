# zkai

OpenAI-compatible Python SDK for [ZKai](https://zkai-ether-og.vercel.app) — private, verifiable AI inference on 0G chain.

ZKai sends your prompt through a Trusted Execution Environment (Intel TDX), encrypts it client-side so even the gateway cannot read it, and anchors a SHA-256 attestation of every inference on the 0G chain. You get back a normal OpenAI-style response plus an on-chain receipt.

## Install

```bash
pip install zkai
```

Optional LangChain adapter:

```bash
pip install "zkai[langchain]"
```

## Quick start

```python
from zkai import ZKai

client = ZKai(api_key="zkai-...")  # get one at https://zkai-ether-og.vercel.app

response = client.chat.completions.create(
    model="qwen2.5:1.5b",
    messages=[{"role": "user", "content": "Hello!"}],
)

print(response.choices[0].message.content)
print("Attestation hash:", response.attestation_hash)
```

The response is decrypted locally — the gateway sees only ciphertext.
The attestation hash is anchored on 0G mainnet and can be verified independently.

## How it works (gateway mode, default)

1. The SDK fetches the enclave's X25519 public key from the gateway.
2. It encrypts your prompt locally with ECDH + ChaCha20-Poly1305.
3. It sends only the ciphertext to the gateway.
4. The gateway routes the opaque blob to a TDX-sealed enclave running the requested model.
5. The enclave decrypts inside sealed memory, runs the model, encrypts the response, and emits a SHA-256 attestation hash.
6. The attestation lands on the on-chain `AttestationRegistry` contract.
7. The SDK decrypts the response locally and returns it to you.

End-to-end, the gateway never sees plaintext.

## Configuration

```python
ZKai(
    api_key="zkai-...",                             # issued from the dashboard
    base_url="https://zkai-ether-og.vercel.app",    # default
    encrypted=True,                                  # default; set False to use the legacy plaintext path
    provider_endpoint=None,                          # set to bypass gateway and hit a provider directly
    skip_attestation=False,                          # only for development; do not disable in prod
)
```

| Argument | Type | Default | Description |
|---|---|---|---|
| `api_key` | `str | None` | `None` | Sent as `X-API-Key`. Required for the hosted gateway. |
| `base_url` | `str | None` | `https://zkai-ether-og.vercel.app` | Override to point at a self-hosted gateway. |
| `encrypted` | `bool` | `True` | When `True`, prompts are encrypted client-side. Set `False` for legacy clients. |
| `provider_endpoint` | `str | None` | `None` | When set, bypasses the gateway and talks directly to a provider's `/infer` endpoint. |
| `skip_attestation` | `bool` | `False` | Disables attestation verification. Useful only for dev loops. |

## OpenAI compatibility

The response object mirrors OpenAI's chat completion shape:

```python
response.id
response.model
response.choices[0].message.content
response.choices[0].finish_reason
response.usage.prompt_tokens
response.usage.completion_tokens

# ZKai-specific:
response.attestation_hash  # on-chain commitment
```

Drop-in replacement for most OpenAI SDK call sites — just swap the client class.

## On-chain components (0G mainnet, chain ID 16661)

| Contract | Address |
|---|---|
| ProviderRegistry | `0x6D400F5D1DcCaA3e98E3dE17322aA23DE38bAC99` |
| PaymentEscrow | `0xb2C7c0F7a4C2877319E8Ed1Fae0bf3C705b6Fc4C` |
| AttestationRegistry | `0x8c8Ae0A113084268D181fd1cf23d611DC2EAa2B2` |

Verify any attestation hash on the [0G explorer](https://chainscan.0g.ai).

## Running your own provider

See the companion [`zkai-cli`](https://pypi.org/project/zkai-cli/) package:

```bash
pip install zkai-cli
zkai init && zkai start && zkai register
```

## Links

- Dashboard — https://zkai-ether-og.vercel.app
- Repository — https://github.com/skyyycodes/zkai-eth
- Provider CLI — https://pypi.org/project/zkai-cli/

## License

MIT
