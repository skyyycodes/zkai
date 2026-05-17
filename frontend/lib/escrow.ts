'use client';

/**
 * Browser-side escrow deposit/withdraw via MetaMask + 0G chain.
 *
 * Flow:
 *  1. Get signer from MetaMask
 *  2. Call PaymentEscrow contract directly with ethers.js
 *  3. User approves tx in MetaMask
 */

import { ethers } from 'ethers';
import { CONTRACTS } from './contracts';

const PAYMENT_ESCROW_ABI = [
  { type: 'function', name: 'deposit', inputs: [], outputs: [], stateMutability: 'payable' },
  { type: 'function', name: 'withdraw', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'balance', inputs: [{ name: '', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
];

export type EscrowAction = 'deposit' | 'withdraw';

export async function callEscrow(
  provider: ethers.BrowserProvider,
  action: EscrowAction,
  amount: bigint,
): Promise<string> {
  const signer = await provider.getSigner();
  const iface = new ethers.Interface(PAYMENT_ESCROW_ABI);
  const signerAddr = await signer.getAddress();
  const network = await provider.getNetwork();
  const nativeBal = await provider.getBalance(signerAddr);

  console.log('[escrow] callEscrow', {
    action,
    to: CONTRACTS.PaymentEscrow,
    amount: amount.toString(),
    amountEther: ethers.formatEther(amount),
    signer: signerAddr,
    chainId: Number(network.chainId),
    nativeBalance: ethers.formatEther(nativeBal),
  });

  // Build the raw tx (skip ethers' estimateGas pre-flight by passing gasLimit
  // explicitly — that way MetaMask shows the popup even if simulation would fail)
  const data = action === 'deposit'
    ? iface.encodeFunctionData('deposit', [])
    : iface.encodeFunctionData('withdraw', [amount]);

  const txRequest = {
    to: CONTRACTS.PaymentEscrow,
    value: action === 'deposit' ? amount : 0n,
    data,
    gasLimit: 200_000n, // generous, avoids estimateGas roundtrip
  };

  console.log('[escrow] sending tx', {
    to: txRequest.to,
    value: txRequest.value.toString(),
    valueEther: ethers.formatEther(txRequest.value),
    data: txRequest.data,
    gasLimit: txRequest.gasLimit.toString(),
  });

  const tx = await signer.sendTransaction(txRequest);
  console.log('[escrow] tx submitted', tx.hash);

  const receipt = await tx.wait();
  console.log('[escrow] tx confirmed', receipt?.hash);
  return receipt?.hash ?? tx.hash;
}

export async function getEscrowBalance(
  provider: ethers.BrowserProvider,
  address: string,
): Promise<bigint> {
  const contract = new ethers.Contract(CONTRACTS.PaymentEscrow, PAYMENT_ESCROW_ABI, provider);
  return contract.balance(address);
}
