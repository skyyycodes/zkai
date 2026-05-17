'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

// ── Slide content ──────────────────────────────────────────────────────────────

type Slide = { eyebrow?: string; node: React.ReactNode };

const SLIDES: Slide[] = [
  // 1 — Title
  {
    node: (
      <div className="flex flex-col items-center text-center gap-8">
        <div className="text-[10px] uppercase tracking-[0.4em] text-cyan-300/60">Hackathon Submission · 0G Mainnet</div>
        <h1 className="text-[clamp(72px,12vw,180px)] font-bold leading-[0.95] tracking-tight">
          ZK<span className="text-cyan-300">ai</span>
        </h1>
        <p className="text-2xl md:text-3xl text-white/60 max-w-2xl">
          Verifiable AI inference. Sealed in TEEs. Settled on 0G.
        </p>
        <div className="mt-12 text-xs uppercase tracking-[0.3em] text-white/30">
          zkai-ether-og.vercel.app
        </div>
      </div>
    ),
  },

  // 2 — Problem
  {
    eyebrow: 'The Problem',
    node: (
      <div className="max-w-4xl space-y-10">
        <h2 className="text-5xl md:text-7xl font-semibold leading-tight">
          You can't verify what your AI provider actually ran.
        </h2>
        <div className="grid md:grid-cols-3 gap-6 text-lg text-white/60">
          <Pain>Did they run the model they claimed?</Pain>
          <Pain>Was your prompt logged?</Pain>
          <Pain>Did they swap in a cheaper model?</Pain>
        </div>
        <p className="text-xl text-white/70">
          Every AI API today runs on faith. There's no receipt.
        </p>
      </div>
    ),
  },

  // 3 — Solution
  {
    eyebrow: 'The Solution',
    node: (
      <div className="max-w-5xl space-y-12">
        <h2 className="text-5xl md:text-7xl font-semibold leading-tight">
          Replace trust with <span className="text-cyan-300">proof</span>.
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          <Solution
            num="01"
            title="Encrypt client-side"
            body="Prompts encrypted with the enclave's X25519 key before leaving your machine."
          />
          <Solution
            num="02"
            title="Run inside a TEE"
            body="Models execute inside Intel TDX-sealed enclaves. The host operator can't read memory."
          />
          <Solution
            num="03"
            title="Anchor on-chain"
            body="Every inference produces a SHA-256 attestation, anchored on 0G mainnet."
          />
        </div>
      </div>
    ),
  },

  // 4 — How it works (flow diagram)
  {
    eyebrow: 'How It Works',
    node: (
      <div className="max-w-6xl w-full space-y-12">
        <h2 className="text-4xl md:text-6xl font-semibold leading-tight">
          OpenAI-compatible. Verifiable end-to-end.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-stretch">
          <FlowBox label="Consumer" sub="encrypts prompt" />
          <FlowArrow />
          <FlowBox label="Gateway" sub="forwards ciphertext" highlight />
          <FlowArrow />
          <FlowBox label="TDX Enclave" sub="decrypts + infers" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-stretch">
          <FlowBox label="On-Chain Receipt" sub="attestation hash" />
          <FlowArrow reverse />
          <FlowBox label="PaymentEscrow" sub="auto-deduct A0GI" highlight />
          <FlowArrow reverse />
          <FlowBox label="Encrypted Response" sub="decrypt locally" />
        </div>
        <p className="text-sm text-white/40 text-center max-w-3xl mx-auto">
          The gateway never sees your prompt or response. Settlement and attestation happen in parallel on 0G mainnet.
        </p>
      </div>
    ),
  },

  // 5 — Live demo (the killer slide)
  {
    eyebrow: 'Live Demo',
    node: (
      <div className="max-w-5xl space-y-8">
        <h2 className="text-5xl md:text-7xl font-semibold leading-tight">
          Two lines to integrate.
        </h2>
        <CodeBlock>
{`from zkai import ZKai

client = ZKai(api_key="zkai-...")

response = client.chat.completions.create(
    model="qwen2.5:1.5b",
    messages=[{"role": "user", "content": "Hello"}],
)

print(response.choices[0].message.content)
print("Attestation:", response.attestation_hash)`}
        </CodeBlock>
        <p className="text-lg text-white/60">
          Same as the OpenAI SDK. Adds a verifiable on-chain receipt.
        </p>
      </div>
    ),
  },

  // 6 — Architecture / 0G integration
  {
    eyebrow: 'Built on 0G',
    node: (
      <div className="max-w-5xl space-y-12">
        <h2 className="text-4xl md:text-6xl font-semibold leading-tight">
          0G Chain handles every economic primitive.
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          <ContractCard
            name="ProviderRegistry"
            addr="0x6D40...AC99"
            role="Registers active GPU providers, their endpoints, models, and prices."
          />
          <ContractCard
            name="PaymentEscrow"
            addr="0xb2C7...Fc4C"
            role="Native A0GI escrow. Auto-deducts per inference, instant settlement."
          />
          <ContractCard
            name="AttestationRegistry"
            addr="0x8c8A...A2B2"
            role="Permanent on-chain commitment of every inference receipt."
          />
        </div>
        <p className="text-sm text-white/40">
          Chain ID 16661 · Explorer: chainscan.0g.ai
        </p>
      </div>
    ),
  },

  // 7 — Why 0G
  {
    eyebrow: 'Why 0G',
    node: (
      <div className="max-w-5xl space-y-12">
        <h2 className="text-4xl md:text-6xl font-semibold leading-tight">
          EVM-compatible. Sub-cent gas. AI-native.
        </h2>
        <div className="grid md:grid-cols-2 gap-x-12 gap-y-8 text-lg">
          <Reason
            title="Shipped the port in a sprint."
            body="ethers.js, Hardhat, MetaMask — kept the entire toolchain. 10-min wallet sync became instant."
          />
          <Reason
            title="Settles in 0G, the native AI token."
            body="No bridge, no wrapped tokens, no off-chain accounting. Native payable contracts."
          />
          <Reason
            title="Sub-cent micropayments."
            body="~130k gas per inference at 4 gwei. Every API call settles on-chain without breaking the unit economics."
          />
          <Reason
            title="Aligned with 0G's thesis."
            body="0G is building the rails for verifiable AI. We're building one of the first apps on top."
          />
        </div>
      </div>
    ),
  },

  // 8 — Traction / What's shipped
  {
    eyebrow: 'Shipped',
    node: (
      <div className="max-w-5xl space-y-12">
        <h2 className="text-4xl md:text-6xl font-semibold leading-tight">
          Live on 0G mainnet today.
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <Metric value="3" label="Solidity contracts deployed on 0G mainnet" />
          <Metric value="E2E" label="X25519 + ChaCha20 encryption from client to enclave" />
          <Metric value="TDX" label="Intel TDX-sealed provider runtime via Gramine" />
          <Metric value="OAI" label="OpenAI-compatible SDK, drop-in for existing code" />
        </div>
        <p className="text-base text-white/50">
          Full stack: Vercel gateway, Fly.io WebSocket relay, Python SDK, CLI, Solidity contracts, Next.js dashboard, MetaMask integration. Open source.
        </p>
      </div>
    ),
  },

  // 9 — Team + Ask
  {
    eyebrow: 'Team & Ask',
    node: (
      <div className="max-w-5xl w-full space-y-12">
        <div className="grid md:grid-cols-2 gap-12">
          <div className="space-y-6">
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300/60">Team</div>
            <h2 className="text-4xl md:text-5xl font-semibold">
              Three engineers. 20+ hackathons won.
            </h2>
            <p className="text-base text-white/60 leading-relaxed">
              Backend at Echo.ai. Full-stack at Nightstar Partners. Blockchain dev, ex-GSoC. We ship.
            </p>
          </div>
          <div className="space-y-6">
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300/60">What we want</div>
            <h2 className="text-4xl md:text-5xl font-semibold">
              First 10 developer teams.
            </h2>
            <p className="text-base text-white/60 leading-relaxed">
              Verifiable inference for AI-first products. Legal-tech, financial-data, agent platforms. People who can't ship on closed AI APIs.
            </p>
          </div>
        </div>
      </div>
    ),
  },

  // 10 — Close
  {
    node: (
      <div className="flex flex-col items-center text-center gap-10 max-w-3xl">
        <div className="text-[10px] uppercase tracking-[0.4em] text-cyan-300/60">Try it now</div>
        <h2 className="text-[clamp(56px,9vw,140px)] font-bold leading-[0.95] tracking-tight">
          Verifiable AI<br/>is one API call away.
        </h2>
        <div className="space-y-2 text-lg text-white/60 mt-6">
          <div className="font-mono">zkai-ether-og.vercel.app</div>
          <div className="font-mono">github.com/skyyycodes/zkai-eth</div>
        </div>
        <div className="mt-10 text-xs uppercase tracking-[0.3em] text-white/30">
          ZKai · Built on 0G
        </div>
      </div>
    ),
  },
];

// ── Atoms ──────────────────────────────────────────────────────────────────────

function Pain({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
      <div className="text-cyan-300/80 text-2xl mb-3 font-mono">?</div>
      <div className="text-white/80">{children}</div>
    </div>
  );
}

function Solution({ num, title, body }: { num: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-cyan-500/[0.04] to-transparent p-7 space-y-4">
      <div className="text-cyan-300 text-sm font-mono">{num}</div>
      <div className="text-xl font-semibold">{title}</div>
      <div className="text-white/60 text-sm leading-relaxed">{body}</div>
    </div>
  );
}

function FlowBox({ label, sub, highlight }: { label: string; sub: string; highlight?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-6 rounded-2xl border ${
        highlight
          ? 'border-cyan-300/40 bg-cyan-300/[0.06]'
          : 'border-white/10 bg-white/[0.02]'
      }`}
    >
      <div className="font-semibold text-base md:text-lg">{label}</div>
      <div className={`text-xs mt-1 ${highlight ? 'text-cyan-200/70' : 'text-white/40'}`}>{sub}</div>
    </div>
  );
}

function FlowArrow({ reverse }: { reverse?: boolean }) {
  return (
    <div className="flex items-center justify-center text-cyan-300/40 text-2xl select-none">
      {reverse ? '←' : '→'}
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="font-mono text-sm md:text-base rounded-2xl border border-white/10 bg-black/60 p-6 md:p-8 overflow-x-auto text-white/85 leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}

function ContractCard({ name, addr, role }: { name: string; addr: string; role: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-3">
      <div className="text-base font-semibold">{name}</div>
      <div className="font-mono text-xs text-cyan-300/80">{addr}</div>
      <div className="text-xs text-white/50 leading-relaxed">{role}</div>
    </div>
  );
}

function Reason({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-2">
      <div className="text-cyan-300/90 font-semibold">{title}</div>
      <div className="text-white/60 text-sm leading-relaxed">{body}</div>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 flex items-baseline gap-5">
      <div className="text-5xl md:text-6xl font-bold text-cyan-300 tabular-nums leading-none">
        {value}
      </div>
      <div className="text-white/70 text-sm leading-snug">{label}</div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DeckPage() {
  const [i, setI] = useState(0);
  const total = SLIDES.length;

  const next = useCallback(() => setI(v => Math.min(v + 1, total - 1)), [total]);
  const prev = useCallback(() => setI(v => Math.max(v - 1, 0)), []);
  const goto = useCallback((idx: number) => setI(Math.min(Math.max(idx, 0), total - 1)), [total]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        prev();
      } else if (e.key === 'Home') {
        e.preventDefault();
        goto(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        goto(total - 1);
      } else if (/^[1-9]$/.test(e.key)) {
        e.preventDefault();
        goto(parseInt(e.key, 10) - 1);
      } else if (e.key === '0') {
        e.preventDefault();
        goto(9);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, goto, total]);

  const slide = SLIDES[i];

  // Lightweight progress dots
  const dots = useMemo(
    () =>
      SLIDES.map((_, idx) => (
        <button
          key={idx}
          onClick={() => goto(idx)}
          aria-label={`Go to slide ${idx + 1}`}
          className={`h-1.5 rounded-full transition-all ${
            idx === i ? 'w-8 bg-cyan-300' : 'w-1.5 bg-white/20 hover:bg-white/40'
          }`}
        />
      )),
    [i, goto],
  );

  return (
    <main className="min-h-screen w-full bg-black text-white overflow-hidden relative">
      {/* Subtle background glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_10%,rgba(34,211,238,0.06)_0%,transparent_30%),radial-gradient(circle_at_88%_85%,rgba(34,211,238,0.05)_0%,transparent_35%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Slide stage */}
      <section
        className="relative z-10 min-h-screen flex flex-col items-center justify-center px-8 md:px-16 py-20"
        onClick={(e) => {
          // Click right half → next, left half → prev (useful for click-through demos)
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const x = e.clientX - rect.left;
          if (x > rect.width / 2) next();
          else prev();
        }}
      >
        {slide.eyebrow && (
          <div className="absolute top-10 left-10 text-xs uppercase tracking-[0.3em] text-white/40">
            {slide.eyebrow}
          </div>
        )}

        <div className="w-full max-w-7xl flex items-center justify-center">
          {slide.node}
        </div>
      </section>

      {/* Footer: counter + dots */}
      <footer className="fixed bottom-6 left-0 right-0 z-20 pointer-events-none">
        <div className="max-w-6xl mx-auto px-8 flex items-center justify-between">
          <div className="text-xs font-mono text-white/30">
            {String(i + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </div>
          <div className="flex items-center gap-1.5 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
            {dots}
          </div>
          <div className="text-xs font-mono text-white/30 hidden md:block">
            ← → space
          </div>
        </div>
      </footer>
    </main>
  );
}
