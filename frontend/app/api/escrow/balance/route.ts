import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

const RPC_URL = process.env.OG_RPC_URL ?? 'https://evmrpc-testnet.0g.ai';
const ESCROW_ADDRESS = process.env.NEXT_PUBLIC_ESCROW_CONTRACT!;

const ABI = [
  'function balance(address) view returns (uint256)',
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');
  if (!address || !ethers.isAddress(address)) {
    return NextResponse.json({ error: 'valid EVM address required' }, { status: 400 });
  }

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(ESCROW_ADDRESS, ABI, provider);
    const bal = await contract.balance(address);
    return NextResponse.json({
      balance_wei: bal.toString(),
      balance_a0gi: ethers.formatEther(bal),
    });
  } catch (e: any) {
    console.error('[escrow/balance] error:', e?.message ?? e);
    return NextResponse.json({ error: e?.message ?? 'Failed to fetch balance' }, { status: 500 });
  }
}
