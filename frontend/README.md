# Kaskad Swap Frontend

Vite + React + TypeScript swap UI for Igra Galleon Testnet.
Uni V2 compatible. Dual-mode: standalone Railway app + importable React component.

## Step 0 — Deploy contracts first

Run the `deploy/` Hardhat project, then update `src/config/contracts.ts`:

```ts
export const FACTORY_ADDRESS = "0xYOUR_FACTORY_ADDRESS";
export const ROUTER_ADDRESS  = "0xYOUR_ROUTER_ADDRESS";
```

## Mode 1 — Standalone app (Railway deploy + iframe)

```bash
npm install
npm run dev        # local dev
npm run build      # production build → dist/
```

Deploy `dist/` to Railway. Then embed anywhere as an iframe:

```html
<iframe
  src="https://your-swap.up.railway.app"
  width="440"
  height="620"
  style="border: none; border-radius: 20px; background: transparent;"
/>
```

## Mode 2 — React component (direct import into Kaskad dApp)

Import `SwapWidgetStandalone` — it manages its own wallet state, no wiring needed:

```tsx
import { SwapWidgetStandalone } from './path/to/kaskad-swap/src/index'
// Don't forget to also import the CSS:
import './path/to/kaskad-swap/src/styles.css'

// In your component:
<SwapWidgetStandalone />

// With options:
<SwapWidgetStandalone maxWidth={400} showNetworkBadge={false} />
```

If you want to share the existing dApp's wallet state instead:

```tsx
import { SwapWidget } from './path/to/kaskad-swap/src/index'

// Pass your existing wallet state (must match WalletState type)
<SwapWidget
  wallet={yourWalletState}
  onConnect={yourConnectFn}
  onSwitchNetwork={yourSwitchFn}
/>
```

## Seeding liquidity

After deploying contracts, seed pools before swaps work. Use Remix connected to Galleon RPC,
calling Router's `addLiquidity` / `addLiquidityETH`.

Recommended initial pairs:
- kaWIKAS / kaUSDC
- kaWIKAS / KSKD
- kaUSDC / KSKD
- kaWIKAS / WETH
- IGRA / kaUSDC

## Token addresses

| Symbol | Address |
|--------|---------|
| kaWIKAS | 0x538be1843C72284672fC8852D3Dc7a269650F555 |
| kaUSDC | 0x1f934cc104685147b953b15357ad5e2475f5BfCF |
| KSKD | 0x61D641D4f86d3977959ceFe15ABA47B39d3e5025 |
| kaWBTC | 0x98d7c81F8aF13D48DbDeeF398d5De881fd7cEeCA |
| WETH | 0xb19b36b1456E65E3A6D514D3F715f204BD59f431 |
| IGRA | 0xaB8c219E5E77afCAeE1a3F70264487e312Af7418 |
