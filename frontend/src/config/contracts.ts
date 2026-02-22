// ============================================================
// KASKAD SWAP - Contract Configuration
// Igra Galleon Testnet (Chain ID: 38836)
// ============================================================

// UPDATE THESE after running the deploy script
export const FACTORY_ADDRESS = "0x76bF18e7E36821e920FB8FbE99DeD541ffF5d7CF";
export const ROUTER_ADDRESS  = "0x695e5db4906b184dF670c271db31374DB3e8308B";

export const GALLEON_CHAIN = {
  chainId: 38836,
  chainIdHex: "0x97B4",
  name: "IGRA Galleon Testnet",
  rpcUrl: "https://galleon-testnet.igralabs.com:8545",
  explorerUrl: "https://explorer.galleon-testnet.igralabs.com",
  nativeCurrency: {
    name: "iKAS",
    symbol: "iKAS",
    decimals: 18,
  },
};

export const TOKENS: Record<string, Token> = {
  kaWIKAS: {
    address: "0x538be1843C72284672fC8852D3Dc7a269650F555",
    symbol: "kaWIKAS",
    name: "Wrapped iKAS",
    decimals: 18,
    isNative: true, // auto-wrap iKAS -> kaWIKAS
  },
  kaUSDC: {
    address: "0x1f934cc104685147b953b15357ad5e2475f5BfCF",
    symbol: "kaUSDC",
    name: "Kaskad USDC",
    decimals: 6,
  },
  KSKD: {
    address: "0x61D641D4f86d3977959ceFe15ABA47B39d3e5025",
    symbol: "KSKD",
    name: "Kaskad Token",
    decimals: 18,
  },
  kaWBTC: {
    address: "0x98d7c81F8aF13D48DbDeeF398d5De881fd7cEeCA",
    symbol: "kaWBTC",
    name: "Kaskad WBTC",
    decimals: 8,
  },
  WETH: {
    address: "0xb19b36b1456E65E3A6D514D3F715f204BD59f431",
    symbol: "WETH",
    name: "Wrapped Ether",
    decimals: 18,
  },
  IGRA: {
    address: "0x328731D9731b1822FDb4D45D28a554FC471BeCE1",
    symbol: "IGRA",
    name: "Igra Token",
    decimals: 18,
  },
};

export type Token = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  isNative?: boolean;
};

export const TOKEN_LIST = Object.values(TOKENS);

// iKAS native currency (for auto-wrap)
export const NATIVE_TOKEN: Token = {
  address: "NATIVE",
  symbol: "iKAS",
  name: "iKAS",
  decimals: 18,
  isNative: true,
};
