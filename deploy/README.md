# Kaskad Swap - Contract Deployment

## Prerequisites
- Node.js 18+
- A funded Galleon testnet wallet (need iKAS for gas)
- Your deployer private key

## Steps

### 1. Install dependencies
```bash
cd deploy/
npm install
```

### 2. Set your private key
Create a `.env` file (never commit this):
```bash
echo "DEPLOYER_PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE" > .env
```

Then update `hardhat.config.js` to load it:
```js
require("dotenv").config();
// accounts: [process.env.DEPLOYER_PRIVATE_KEY]
```
Or just replace `process.env.DEPLOYER_PRIVATE_KEY` directly with your key for a quick test (remove after).

### 3. Deploy
```bash
npm run deploy
```

### 4. Note the outputs
The script will print and save to `deployed-addresses.json`:
- `factory` address
- `router` address  
- `initCodeHash`

### 5. CRITICAL - Check INIT_CODE_HASH
The `UniswapV2Library.pairFor()` function in the Router uses a hardcoded init code hash to compute pair addresses without calling the chain.

The OG Uni V2 hash is: `0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f`

**If the INIT_CODE_HASH printed by the deploy script differs from the above**, you must:
1. Open `contracts/UniswapV2Router02.sol`
2. Find the line with `hex'96e8ac42...'` in `pairFor()`
3. Replace it with the actual hash from your deployment
4. Redeploy the router only

### 6. Update the frontend
Copy the factory and router addresses into:
```
frontend/src/config/contracts.ts
```

## Network
- Chain ID: 38836
- RPC: https://galleon-testnet.igralabs.com:8545
- Explorer: https://explorer.galleon-testnet.igralabs.com
