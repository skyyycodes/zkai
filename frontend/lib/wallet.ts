'use client';

import { ethers } from 'ethers';

export interface WalletState {
  address: string;
  balance: bigint;
  chainId: number;
}

// Backwards-compat alias used across dashboard components
export type ConnectedAPI = ethers.BrowserProvider;

declare global {
  interface Window {
    ethereum?: any;
  }
}

// EIP-6963 announced provider discovery
interface EIP6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}
interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo;
  provider: any;
}

const _discoveredProviders: EIP6963ProviderDetail[] = [];

if (typeof window !== 'undefined') {
  window.addEventListener('eip6963:announceProvider', ((event: CustomEvent<EIP6963ProviderDetail>) => {
    const detail = event.detail;
    if (!_discoveredProviders.find(p => p.info.uuid === detail.info.uuid)) {
      _discoveredProviders.push(detail);
    }
  }) as EventListener);
  window.dispatchEvent(new Event('eip6963:requestProvider'));
}

function findMetaMaskProvider(): any | null {
  if (typeof window === 'undefined') return null;

  // 1. EIP-6963 — modern multi-wallet discovery (preferred)
  const mmDetail = _discoveredProviders.find(p =>
    p.info.rdns === 'io.metamask' || /metamask/i.test(p.info.name)
  );
  if (mmDetail) return mmDetail.provider;

  // 2. Legacy `window.ethereum.providers[]` — set by some multi-wallet setups
  const providers = window.ethereum?.providers as any[] | undefined;
  if (Array.isArray(providers)) {
    const mm = providers.find(p => p?.isMetaMask && !p?.isCoreWallet && !p?.isAvalanche);
    if (mm) return mm;
  }

  // 3. Single-wallet — only return if it's actually MetaMask
  // (Core wallet sets isMetaMask=true to mimic, so check for tell-tale Core/Avalanche flags)
  const eth = window.ethereum;
  if (eth?.isMetaMask && !eth?.isCoreWallet && !eth?.isAvalanche) {
    return eth;
  }

  return null;
}

export function isMetaMaskAvailable(): boolean {
  return findMetaMaskProvider() !== null;
}

export async function connectWallet(): Promise<{ provider: ethers.BrowserProvider; state: WalletState }> {
  // Re-poll for EIP-6963 providers (poll a few times in case extension loads late)
  if (typeof window !== 'undefined') {
    for (let i = 0; i < 6; i++) {
      window.dispatchEvent(new Event('eip6963:requestProvider'));
      if (findMetaMaskProvider()) break;
      await new Promise(r => setTimeout(r, 100));
    }
  }

  const mmProvider = findMetaMaskProvider();
  if (!mmProvider) {
    throw new Error('MetaMask not found. Install MetaMask to continue.');
  }

  // Direct EIP-1193 call instead of going through ethers — gives us a faster
  // failure mode if the wallet popup is blocked/closed
  const accounts: string[] = await mmProvider.request({ method: 'eth_requestAccounts' });
  if (!accounts || accounts.length === 0) {
    throw new Error('No account selected in MetaMask.');
  }

  const provider = new ethers.BrowserProvider(mmProvider);
  const address = accounts[0];
  const [balance, network] = await Promise.all([
    provider.getBalance(address),
    provider.getNetwork(),
  ]);
  return { provider, state: { address, balance, chainId: Number(network.chainId) } };
}

export async function refreshWalletState(provider: ethers.BrowserProvider): Promise<WalletState> {
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  const balance = await provider.getBalance(address);
  const network = await provider.getNetwork();
  return { address, balance, chainId: Number(network.chainId) };
}

// 0G Mainnet — chain ID 16661 (0x4115)
export async function switchTo0GMainnet(provider: ethers.BrowserProvider): Promise<void> {
  try {
    await provider.send('wallet_switchEthereumChain', [{ chainId: '0x4115' }]);
  } catch (e: any) {
    if (e.code === 4902) {
      await provider.send('wallet_addEthereumChain', [{
        chainId: '0x4115',
        chainName: '0G Mainnet',
        nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
        rpcUrls: ['https://evmrpc.0g.ai'],
        blockExplorerUrls: ['https://chainscan.0g.ai'],
      }]);
    } else {
      throw e;
    }
  }
}

// Backwards-compat alias — old code calls switchTo0GGalileo
export const switchTo0GGalileo = switchTo0GMainnet;

const WALLET_SESSION_KEY = 'zkai_wallet_connected';

export function persistWalletSession(): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(WALLET_SESSION_KEY, '1'); } catch {}
}

export function clearWalletSession(): void {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(WALLET_SESSION_KEY); } catch {}
}

export function hasPersistedWalletSession(): boolean {
  if (typeof window === 'undefined') return false;
  try { return localStorage.getItem(WALLET_SESSION_KEY) === '1'; } catch { return false; }
}
