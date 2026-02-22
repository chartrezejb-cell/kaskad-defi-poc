import React from "react";

type Props = {
  address: string | null;
  isConnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
};

function truncate(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function WalletButton({ address, isConnecting, onConnect, onDisconnect }: Props) {
  if (address) {
    return (
      <button className="wallet-btn wallet-btn--connected" onClick={onDisconnect}>
        <span className="wallet-dot" />
        {truncate(address)}
      </button>
    );
  }

  return (
    <button className="wallet-btn" onClick={onConnect} disabled={isConnecting}>
      {isConnecting ? "Connecting..." : "Connect Wallet"}
    </button>
  );
}
