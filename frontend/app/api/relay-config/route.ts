import { NextResponse } from 'next/server';

export async function GET() {
  const secret = process.env.ZKAI_RELAY_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Relay not configured' }, { status: 503 });
  }
  return NextResponse.json({
    relay_url: process.env.ZKAI_RELAY_URL ?? 'https://zkai-relay.fly.dev',
    relay_secret: secret,
    auth_url: process.env.ZKAI_AUTH_URL ?? 'https://zkai-ether-og.vercel.app',
    og_rpc_url: process.env.OG_RPC_URL ?? 'https://evmrpc-testnet.0g.ai',
    price_per_request: Number(process.env.ZKAI_PRICE_PER_REQUEST ?? 100),
  });
}
