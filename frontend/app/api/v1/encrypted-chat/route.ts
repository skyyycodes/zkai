/**
 * POST /api/v1/encrypted-chat
 *
 * End-to-end encrypted inference path. The SDK has already encrypted the
 * prompt with the enclave's X25519 pubkey, so the gateway only sees an
 * opaque ciphertext. We:
 *   1. Verify API key
 *   2. Pick the same provider whose pubkey the SDK fetched
 *   3. Forward { client_pubkey, encrypted_prompt } to enclave /infer
 *   4. Return encrypted_response + attestation_hash to SDK
 *
 * Body:
 *   { provider_id, client_pubkey, encrypted_prompt, model }
 *
 * Returns:
 *   { job_id, encrypted_response, attestation_hash }
 */

import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';

interface Provider {
  id: string;
  endpoint: string;
  model: string;
  price: number;
  reputation: number;
}

async function verifyKey(key: string): Promise<{ walletAddress: string } | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT wallet_address FROM api_keys
    WHERE key = ${key} AND revoked = FALSE
  `;
  if (rows.length === 0) return null;
  return { walletAddress: rows[0].wallet_address };
}

async function getProviderById(id: string): Promise<Provider | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, endpoint, model, price, reputation
    FROM providers
    WHERE id = ${id} AND active = TRUE
  `;
  return (rows[0] ?? null) as Provider | null;
}

export async function POST(req: Request) {
  const sql = getSql();

  const apiKey = req.headers.get('x-api-key') ?? req.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing API key' }, { status: 401 });
  }
  const keyData = await verifyKey(apiKey);
  if (!keyData) {
    return NextResponse.json({ error: 'Invalid or revoked API key' }, { status: 401 });
  }
  const { walletAddress } = keyData;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { provider_id, client_pubkey, encrypted_prompt, model } = body;
  if (!provider_id || !client_pubkey || !encrypted_prompt) {
    return NextResponse.json(
      { error: 'provider_id, client_pubkey, encrypted_prompt required' },
      { status: 400 },
    );
  }

  const provider = await getProviderById(provider_id);
  if (!provider) {
    return NextResponse.json({ error: 'Provider not found or inactive' }, { status: 404 });
  }

  // Forward encrypted payload to the enclave's /infer endpoint.
  // For relay endpoints, the relay forwards to the local enclave path /infer.
  const isRelay = provider.endpoint.includes('/relay/');
  const targetUrl = isRelay
    ? provider.endpoint.replace(/\/$/, '')
    : `${provider.endpoint.replace(/\/$/, '')}/infer`;

  const fwHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-API-Key': apiKey,
    'X-Wallet-Address': walletAddress,
  };
  if (isRelay) {
    fwHeaders['X-Relay-Path'] = '/infer';
    fwHeaders['X-Relay-Method'] = 'POST';
  }

  let providerRes: Response;
  try {
    providerRes = await fetch(targetUrl, {
      method: 'POST',
      headers: fwHeaders,
      body: JSON.stringify({ client_pubkey, encrypted_prompt }),
      // @ts-ignore
      signal: AbortSignal.timeout(115_000),
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Provider unreachable', detail: e.message }, { status: 502 });
  }

  const data = await providerRes.json();
  if (!providerRes.ok) {
    return NextResponse.json(data, { status: providerRes.status });
  }

  // Log the job — note: prompt/response stay encrypted, only metadata logged
  const jobId = data.job_id ?? crypto.randomUUID();
  sql`INSERT INTO jobs (job_id, wallet_address, provider_id, amount, model, attestation_hash)
      VALUES (${jobId}, ${walletAddress}, ${provider.id}, ${provider.price}, ${model ?? provider.model},
              ${data.attestation_hash ?? null})
      ON CONFLICT (job_id) DO NOTHING`.catch(() => {});

  return NextResponse.json({
    job_id: jobId,
    encrypted_response: data.encrypted_response,
    attestation_hash: data.attestation_hash,
    provider_id: provider.id,
  });
}
