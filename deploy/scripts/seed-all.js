const { ethers } = require("hardhat");

const ROUTER_ADDRESS  = "0x695e5db4906b184dF670c271db31374DB3e8308B";
const FACTORY_ADDRESS = "0x76bF18e7E36821e920FB8FbE99DeD541ffF5d7CF";
const WETH_ADDRESS    = "0x538be1843C72284672fC8852D3Dc7a269650F555"; // kaWIKAS

const TOKENS = {
  kaUSDC:  { address: "0x1f934cc104685147b953b15357ad5e2475f5BfCF", decimals: 6  },
  KSKD:    { address: "0x61D641D4f86d3977959ceFe15ABA47B39d3e5025", decimals: 18 },
  kaWBTC:  { address: "0x98d7c81F8aF13D48DbDeeF398d5De881fd7cEeCA", decimals: 8  },
  WETH:    { address: "0xb19b36b1456E65E3A6D514D3F715f204BD59f431", decimals: 18 },
  IGRA:    { address: "0xaB8c219E5E77afCAeE1a3F70264487e312Af7418", decimals: 18 },
};

// ============================================================
// SEED AMOUNTS
// Each pair: iKAS (native) paired with token
// Adjust amounts and prices freely
// ============================================================
const PAIRS = [
  {
    name: "iKAS / kaUSDC",
    token: TOKENS.kaUSDC,
    ikasAmount:  ethers.parseEther("100"),
    tokenAmount: ethers.parseUnits("50", 6),      // 1 iKAS = 0.05 kaUSDC
  },
  {
    name: "iKAS / KSKD",
    token: TOKENS.KSKD,
    ikasAmount:  ethers.parseEther("100"),
    tokenAmount: ethers.parseUnits("10000", 18),  // 1 iKAS = 10 KSKD
  },
  {
    name: "iKAS / kaWBTC",
    token: TOKENS.kaWBTC,
    ikasAmount:  ethers.parseEther("100"),
    tokenAmount: ethers.parseUnits("0.01", 8),    // 1 iKAS = 0.00001 kaWBTC
  },
  {
    name: "iKAS / WETH",
    token: TOKENS.WETH,
    ikasAmount:  ethers.parseEther("100"),
    tokenAmount: ethers.parseUnits("0.5", 18),    // 1 iKAS = 0.0005 WETH
  },
  {
    name: "iKAS / IGRA",
    token: TOKENS.IGRA,
    ikasAmount:  ethers.parseEther("100"),
    tokenAmount: ethers.parseUnits("5000", 18),   // 1 iKAS = 5 IGRA
  },
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
];

const ROUTER_ABI = [
  "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)",
];

const FACTORY_ABI = [
  "function getPair(address tokenA, address tokenB) external view returns (address pair)",
];

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Seeding all pairs with:", deployer.address);
  console.log("iKAS balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)));

  const router  = new ethers.Contract(ROUTER_ADDRESS,  ROUTER_ABI,  deployer);
  const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, deployer);
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

  // Approve all tokens first
  console.log("\n--- Approving all tokens ---");
  for (const [symbol, token] of Object.entries(TOKENS)) {
    const contract = new ethers.Contract(token.address, ERC20_ABI, deployer);
    const bal = await contract.balanceOf(deployer.address);
    if (bal === 0n) {
      console.log(`  ${symbol}: skipping (zero balance)`);
      continue;
    }
    const tx = await contract.approve(ROUTER_ADDRESS, ethers.MaxUint256);
    await tx.wait();
    console.log(`  ${symbol}: approved`);
  }

  // Seed each pair
  console.log("\n--- Seeding pairs ---");
  for (const pair of PAIRS) {
    const contract = new ethers.Contract(pair.token.address, ERC20_ABI, deployer);
    const bal = await contract.balanceOf(deployer.address);

    if (bal < pair.tokenAmount) {
      console.log(`  ${pair.name}: SKIPPED (insufficient token balance)`);
      continue;
    }

    try {
      console.log(`\n  Seeding ${pair.name}...`);
      const tx = await router.addLiquidityETH(
        pair.token.address,
        pair.tokenAmount,
        0,
        0,
        deployer.address,
        deadline,
        { value: pair.ikasAmount, gasPrice: 2000000000000 }
      );
      const receipt = await tx.wait();
      const pairAddr = await factory.getPair(WETH_ADDRESS, pair.token.address);
      console.log(`  ✓ ${pair.name} — pair: ${pairAddr} (block ${receipt.blockNumber})`);
    } catch (err) {
      console.log(`  ✗ ${pair.name} failed: ${err.reason || err.message}`);
    }
  }

  console.log("\n=== ALL DONE — check your swap UI ===");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
