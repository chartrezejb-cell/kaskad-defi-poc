import React, { useState } from "react";
import { useWallet } from "./hooks/useWallet";
import { SwapWidget } from "./components/SwapWidget";
import { LiquidityWidget } from "./components/LiquidityWidget";
import { WalletButton } from "./components/WalletButton";

type Tab = "swap" | "liquidity";

export default function App() {
  const wallet = useWallet();
  const [tab, setTab] = useState<Tab>("swap");

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-logo">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="8" fill="#0f766e"/>
            <path d="M8 14h12M14 8l6 6-6 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="logo-text">Kaskad <span className="logo-sub">Swap</span></span>
        </div>
        <div className="header-right">
          <div className="network-badge">
            <span className="network-dot" />
            Galleon Testnet
          </div>
          <WalletButton
            address={wallet.address}
            isConnecting={wallet.isConnecting}
            onConnect={wallet.connect}
            onDisconnect={wallet.disconnect}
          />
        </div>
      </header>

      <main className="app-main">
        {/* Main tabs */}
        <div className="main-tabs">
          <button
            className={`main-tab ${tab === "swap" ? "main-tab--active" : ""}`}
            onClick={() => setTab("swap")}
          >
            Swap
          </button>
          <button
            className={`main-tab ${tab === "liquidity" ? "main-tab--active" : ""}`}
            onClick={() => setTab("liquidity")}
          >
            Liquidity
          </button>
        </div>

        {tab === "swap" ? (
          <SwapWidget
            wallet={wallet}
            onConnect={wallet.connect}
            onSwitchNetwork={wallet.switchNetwork}
          />
        ) : (
          <LiquidityWidget
            wallet={wallet}
            onConnect={wallet.connect}
            onSwitchNetwork={wallet.switchNetwork}
          />
        )}

        <p className="testnet-notice">
          Igra Galleon Testnet — assets have no real value
        </p>
      </main>
    </div>
  );
}
