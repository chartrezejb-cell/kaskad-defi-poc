import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { GALLEON_CHAIN } from "../config/contracts";

export type WalletState = {
  address: string | null;
  provider: ethers.providers.Web3Provider | null;
  signer: ethers.Signer | null;
  chainId: number | null;
  isConnecting: boolean;
  isCorrectNetwork: boolean;
  error: string | null;
};

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    address: null,
    provider: null,
    signer: null,
    chainId: null,
    isConnecting: false,
    isCorrectNetwork: false,
    error: null,
  });

  const connect = useCallback(async () => {
    const { ethereum } = window as any;
    if (!ethereum) {
      setState((s) => ({ ...s, error: "No wallet detected. Install MetaMask." }));
      return;
    }

    setState((s) => ({ ...s, isConnecting: true, error: null }));

    try {
      await ethereum.request({ method: "eth_requestAccounts" });
      const provider = new ethers.providers.Web3Provider(ethereum, "any");
      const signer = provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();

      setState({
        address,
        provider,
        signer,
        chainId: network.chainId,
        isConnecting: false,
        isCorrectNetwork: network.chainId === GALLEON_CHAIN.chainId,
        error: null,
      });
    } catch (err: any) {
      setState((s) => ({
        ...s,
        isConnecting: false,
        error: err?.message || "Connection failed",
      }));
    }
  }, []);

  const switchNetwork = useCallback(async () => {
    const { ethereum } = window as any;
    if (!ethereum) return;

    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: GALLEON_CHAIN.chainIdHex }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: GALLEON_CHAIN.chainIdHex,
                chainName: GALLEON_CHAIN.name,
                nativeCurrency: GALLEON_CHAIN.nativeCurrency,
                rpcUrls: [GALLEON_CHAIN.rpcUrl],
                blockExplorerUrls: [GALLEON_CHAIN.explorerUrl],
              },
            ],
          });
        } catch (addError: any) {
          setState((s) => ({ ...s, error: "Failed to add network" }));
        }
      }
    }
  }, []);

  const disconnect = useCallback(() => {
    setState({
      address: null,
      provider: null,
      signer: null,
      chainId: null,
      isConnecting: false,
      isCorrectNetwork: false,
      error: null,
    });
  }, []);

  // Listen for account/chain changes
  useEffect(() => {
    const { ethereum } = window as any;
    if (!ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect();
      } else {
        setState((s) => ({ ...s, address: accounts[0] }));
      }
    };

    const handleChainChanged = (chainIdHex: string) => {
      const chainId = parseInt(chainIdHex, 16);
      setState((s) => ({
        ...s,
        chainId,
        isCorrectNetwork: chainId === GALLEON_CHAIN.chainId,
      }));
      // Re-init provider on chain change
      const provider = new ethers.providers.Web3Provider(ethereum, "any");
      const signer = provider.getSigner();
      setState((s) => ({ ...s, provider, signer }));
    };

    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);

    // Auto-reconnect if already connected
    ethereum
      .request({ method: "eth_accounts" })
      .then((accounts: string[]) => {
        if (accounts.length > 0) connect();
      })
      .catch(() => {});

    return () => {
      ethereum.removeListener("accountsChanged", handleAccountsChanged);
      ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, [connect, disconnect]);

  return { ...state, connect, disconnect, switchNetwork };
}
