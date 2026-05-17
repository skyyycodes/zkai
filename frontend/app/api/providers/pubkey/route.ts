/**
 * GET /api/providers/pubkey?model=qwen2.5-1.5b
 *
 * Returns the TDX enclave's X25519 public key for the provider that would
 * be selected for this model. The SDK uses this to encrypt prompts
 * end-to-end so the gateway never sees plaintext.
 *
 * For relay-backed providers, we POST to the relay with X-Relay-Path: /pubkey
 * and X-Relay-Method: GET so the relay's WS client forwards a GET request
 * to the local enclave.
 */

import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';

interface Provider {
  id: string;
  endpoint: string;
  model: string;
  reputation: number;
}

function normalizeModel(s: string): string {
  return s.toLowerCase().replace(/[:_-]/g, '');
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const model = searchParams.get('model') ?? '';

  const sql = getSql();
  const rows = (await sql`
    SELECT id, endpoint, model, reputation
    FROM providers
    WHERE active = TRUE
    ORDER BY reputation DESC
  `) as Provider[];

  // Loose model match — treat qwen2.5:1.5b == qwen2.5-1.5b == qwen2.51.5b
  const target = normalizeModel(model);
  const matching = rows.filter(p =>
    target ? normalizeModel(p.model).includes(target) || target.includes(normalizeModel(p.model)) : true
  );
  const pool = matching.length > 0 ? matching : rows;
  if (pool.length === 0) {
    return NextResponse.json({ error: 'No providers available' }, { status: 503 });
  }

  // Try each provider in reputation order until one responds with a pubkey
  let lastError: string = 'all providers unreachable';
  for (const provider of pool) {
    const isRelay = provider.endpoint.includes('/relay/');
    try {
      let pubkeyUrl: string;
      let fetchInit: RequestInit;

      if (isRelay) {
        // POST to relay with header overrides so it forwards GET /pubkey to the enclave
        pubkeyUrl = provider.endpoint.replace(/\/$/, '');
        fetchInit = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Relay-Path': '/pubkey',
            'X-Relay-Method': 'GET',
          },
          body: '{}',
          // @ts-ignore
          signal: AbortSignal.timeout(10_000),
        };
      } else {
        // Direct endpoint — plain GET /pubkey
        pubkeyUrl = `${provider.endpoint.replace(/\/$/, '')}/pubkey`;
        fetchInit = {
          method: 'GET',
          // @ts-ignore
          signal: AbortSignal.timeout(10_000),
        };
      }

      const res = await fetch(pubkeyUrl, fetchInit);
      if (!res.ok) {
        lastError = `provider ${provider.id} returned ${res.status}`;
        continue;
      }
      const data = await res.json();
      if (!data?.pubkey) {
        lastError = `provider ${provider.id} returned no pubkey`;
        continue;
      }
      return NextResponse.json({
        provider_id: provider.id,
        pubkey: data.pubkey,
        model: provider.model,
      });
    } catch (e: any) {
      lastError = e?.message ?? String(e);
      continue;
    }
  }
  return NextResponse.json({ error: lastError }, { status: 502 });
}
