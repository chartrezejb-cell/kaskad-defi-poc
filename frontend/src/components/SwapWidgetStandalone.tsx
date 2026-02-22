/**
 * SwapWidgetStandalone
 *
 * Drop-in component for the Kaskad testnet dApp.
 * Manages its own wallet state — no props required.
 *
 * Usage in existing dApp:
 *   import { SwapWidgetStandalone } from '@/components/SwapWidgetStandalone'
 *   ...
 *   <SwapWidgetStandalone />
 *
 * Or as an iframe:
 *   <iframe src="https://your-swap.up.railway.app" width="440" height="620"
 *     style={{ border: 'none', borderRadius: '20px' }} />
 */

import React from "react";
import { useWallet } from "../hooks/useWallet";
import { SwapWidget } from "./SwapWidget";
import { GALLEON_CHAIN } from "../config/contracts";

type Props = {
  /** Override max-width. Defaults to 420px. */
  maxWidth?: number;
  /** Show/hide the "Galleon Testnet" network badge inside the widget header */
  showNetworkBadge?: boolean;
};

export function SwapWidgetStandalone({ maxWidth = 420, showNetworkBadge = true }: Props) {
  const wallet = useWallet();

  return (
    <div style={{ width: "100%", maxWidth, margin: "0 auto" }}>
      {showNetworkBadge && (
        <div className="embedded-network-badge">
          <span className="network-dot" />
          {GALLEON_CHAIN.name}
          {wallet.address && !wallet.isCorrectNetwork && (
            <span className="badge-warning"> — wrong network</span>
          )}
        </div>
      )}
      <SwapWidget
        wallet={wallet}
        onConnect={wallet.connect}
        onSwitchNetwork={wallet.switchNetwork}
        embedded
      />
    </div>
  );
}
