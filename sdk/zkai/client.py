"""
ZKai client — OpenAI-compatible interface with end-to-end encryption.

Modes:
  - Encrypted gateway (default): prompt encrypted client-side with the
    enclave's X25519 pubkey; gateway sees only ciphertext.
  - Plain gateway: legacy fallback for compatibility.
  - Direct provider: bypass gateway entirely.

Change 2 lines, everything else stays the same.
"""

import requests
from dataclasses import dataclass, field

from . import crypto, provider as provider_mod, attestation as att_mod
from .attestation import ZKaiAttestationError

# Default gateway — consumers send requests here, gateway picks a provider
GATEWAY_URL = "https://zkai-ether-og.vercel.app"


# ── OpenAI-compatible response types ────────────────────────────────────────

@dataclass
class Message:
    role: str
    content: str


@dataclass
class Choice:
    index: int
    message: Message
    finish_reason: str = "stop"


@dataclass
class ChatCompletion:
    id: str
    object: str
    model: str
    choices: list[Choice]
    usage: dict = field(default_factory=dict)
    attestation_hash: str | None = None


# ── Main client ──────────────────────────────────────────────────────────────

class ZKai:
    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        # legacy / advanced: bypass gateway and talk to a provider directly
        provider_endpoint: str | None = None,
        max_price: float | None = None,
        min_reputation: float = 0.0,
        registry_contract: str | None = None,
        attestation_contract: str | None = None,
        skip_attestation: bool = False,
        # End-to-end encryption via gateway (default ON). Set False to use
        # the legacy plaintext-to-gateway path.
        encrypted: bool = True,
    ):
        self._api_key = api_key
        self._base_url = (base_url or GATEWAY_URL).rstrip("/")
        self._provider_endpoint = provider_endpoint
        self._max_price = max_price
        self._min_reputation = min_reputation
        self._registry_contract = registry_contract
        self._attestation_contract = attestation_contract
        self._skip_attestation = skip_attestation
        self._encrypted = encrypted
        self.chat = _Chat(self)

    def _infer(self, model: str, messages: list[dict]) -> ChatCompletion:
        if self._provider_endpoint:
            return self._infer_direct(model, messages)
        if self._encrypted:
            return self._infer_via_gateway_encrypted(model, messages)
        return self._infer_via_gateway_plain(model, messages)

    # ── Encrypted gateway path (default) ─────────────────────────────────────

    def _infer_via_gateway_encrypted(self, model: str, messages: list[dict]) -> ChatCompletion:
        """
        End-to-end encrypted via the ZKai gateway.

        Flow:
          1. GET  /api/providers/pubkey?model=...  → enclave pubkey + provider_id
          2. Generate ephemeral X25519 keypair locally
          3. Encrypt prompt with ECDH(ephemeral_priv, enclave_pub) → ciphertext
          4. POST /api/v1/encrypted-chat  with { provider_id, client_pubkey, encrypted_prompt }
          5. Decrypt response with ECDH(ephemeral_priv, enclave_pub)

        Gateway never sees plaintext.
        """
        headers = {"Content-Type": "application/json"}
        if self._api_key:
            headers["X-API-Key"] = self._api_key

        # 1. Fetch enclave pubkey for this model
        pk_resp = requests.get(
            f"{self._base_url}/api/providers/pubkey",
            params={"model": model},
            headers=headers,
            timeout=15,
        )
        if pk_resp.status_code == 503:
            raise ZKaiNoProviderError("No providers available for this model.")
        pk_resp.raise_for_status()
        pk_data = pk_resp.json()
        enclave_pubkey = pk_data["pubkey"]
        provider_id = pk_data["provider_id"]

        # 2-3. Generate ephemeral keypair + encrypt
        prompt = _messages_to_prompt(messages)
        our_priv, our_pub = crypto.generate_keypair()
        encrypted_prompt = crypto.encrypt(prompt, enclave_pubkey, our_priv)

        # 4. Send encrypted blob via gateway
        resp = requests.post(
            f"{self._base_url}/api/v1/encrypted-chat",
            json={
                "provider_id": provider_id,
                "client_pubkey": our_pub,
                "encrypted_prompt": encrypted_prompt,
                "model": model,
            },
            headers=headers,
            timeout=120,
        )
        if resp.status_code == 401:
            raise ZKaiAuthError("Invalid or missing API key. Get one at https://zkai-ether-og.vercel.app")
        if resp.status_code == 503:
            raise ZKaiNoProviderError("No providers available for this model.")
        resp.raise_for_status()
        data = resp.json()

        # 5. Decrypt response locally
        response_text = crypto.decrypt(data["encrypted_response"], enclave_pubkey, our_priv)
        token_count = len(response_text.split())

        return ChatCompletion(
            id=f"zkai-{data['job_id'][:8]}",
            object="chat.completion",
            model=model,
            choices=[Choice(
                index=0,
                message=Message(role="assistant", content=response_text),
                finish_reason="stop",
            )],
            usage={"prompt_tokens": len(prompt.split()), "completion_tokens": token_count},
            attestation_hash=data.get("attestation_hash"),
        )

    # ── Plain gateway path (legacy) ──────────────────────────────────────────

    def _infer_via_gateway_plain(self, model: str, messages: list[dict]) -> ChatCompletion:
        """Send plaintext request to the ZKai gateway (legacy)."""
        headers = {"Content-Type": "application/json"}
        if self._api_key:
            headers["X-API-Key"] = self._api_key

        resp = requests.post(
            f"{self._base_url}/api/v1/chat/completions",
            json={"model": model, "messages": messages},
            headers=headers,
            timeout=120,
        )
        if resp.status_code == 401:
            raise ZKaiAuthError("Invalid or missing API key.")
        if resp.status_code == 503:
            raise ZKaiNoProviderError("No providers available for this model.")
        resp.raise_for_status()
        data = resp.json()

        choice = data["choices"][0]
        xz = data.get("x_zkai", {})
        return ChatCompletion(
            id=data.get("id", "zkai-gateway"),
            object="chat.completion",
            model=data.get("model", model),
            choices=[Choice(
                index=0,
                message=Message(role="assistant", content=choice["message"]["content"]),
                finish_reason=choice.get("finish_reason", "stop"),
            )],
            usage=data.get("usage", {}),
            attestation_hash=xz.get("attestation_hash"),
        )

    # ── Direct provider path (advanced) ──────────────────────────────────────

    def _infer_direct(self, model: str, messages: list[dict]) -> ChatCompletion:
        """Bypass gateway — encrypt and send directly to a provider enclave."""
        prompt = _messages_to_prompt(messages)

        p = provider_mod.Provider(
            id="direct",
            endpoint=self._provider_endpoint,
            pubkey="",
            model=model,
            price_per_token=0.0,
            reputation=1.0,
            stake=0.0,
        )

        tee_pubkey = provider_mod.fetch_pubkey(p)
        our_private, our_public = crypto.generate_keypair()
        encrypted_prompt = crypto.encrypt(prompt, tee_pubkey, our_private)

        headers = {"X-API-Key": self._api_key} if self._api_key else {}
        resp = requests.post(
            f"{p.endpoint}/infer",
            json={"client_pubkey": our_public, "encrypted_prompt": encrypted_prompt},
            headers=headers,
            timeout=120,
        )
        if resp.status_code == 401:
            raise ZKaiAuthError("Invalid or missing API key.")
        resp.raise_for_status()
        data = resp.json()

        job_id = data["job_id"]

        if not self._skip_attestation:
            att_mod.verify(
                provider_url=p.endpoint,
                received_attestation_hash=data["attestation_hash"],
                attestation_contract=self._attestation_contract,
                job_id=job_id,
            )

        response_text = crypto.decrypt(data["encrypted_response"], tee_pubkey, our_private)
        token_count = len(response_text.split())

        return ChatCompletion(
            id=f"zkai-{job_id[:8]}",
            object="chat.completion",
            model=model,
            choices=[Choice(index=0, message=Message(role="assistant", content=response_text))],
            usage={"prompt_tokens": len(prompt.split()), "completion_tokens": token_count},
            attestation_hash=data.get("attestation_hash"),
        )


class _Chat:
    def __init__(self, client: ZKai):
        self.completions = _Completions(client)


class _Completions:
    def __init__(self, client: ZKai):
        self._client = client

    def create(self, model: str, messages: list[dict], **kwargs) -> ChatCompletion:
        return self._client._infer(model, messages)


# ── Exceptions ───────────────────────────────────────────────────────────────

class ZKaiAuthError(Exception):
    pass


class ZKaiNoProviderError(Exception):
    pass


# ── Helpers ──────────────────────────────────────────────────────────────────

def _messages_to_prompt(messages: list[dict]) -> str:
    parts = []
    for m in messages:
        role = m.get("role", "user")
        content = m.get("content", "")
        if role == "system":
            parts.append(f"System: {content}")
        elif role == "user":
            parts.append(f"User: {content}")
        elif role == "assistant":
            parts.append(f"Assistant: {content}")
    parts.append("Assistant:")
    return "\n".join(parts)
