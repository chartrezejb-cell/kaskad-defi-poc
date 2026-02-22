const { ethers } = require("hardhat");
const fs = require("fs");

const WETH_ADDRESS = "0x538be1843C72284672fC8852D3Dc7a269650F555";
const FACTORY_ADDRESS = "0x76bF18e7E36821e920FB8FbE99DeD541ffF5d7CF"; // already deployed

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Redeploying Router with correct INIT_CODE_HASH...");

  const Router = await ethers.getContractFactory("UniswapV2Router02");
  const router = await Router.deploy(FACTORY_ADDRESS, WETH_ADDRESS);
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log("UniswapV2Router02 deployed to:", routerAddress);

  const addresses = {
    network: "IGRA Galleon Testnet",
    chainId: 38836,
    factory: FACTORY_ADDRESS,
    router: routerAddress,
    weth: WETH_ADDRESS,
    initCodeHash: "0x5307d586ca33c010656b24dd8e3101b0a7ff53e4aa0b245d7d8b5239cb5d1a74",
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
  };

  fs.writeFileSync("deployed-addresses.json", JSON.stringify(addresses, null, 2));
  console.log("\n=== DONE ===");
  console.log("Factory:", FACTORY_ADDRESS);
  console.log("Router:", routerAddress);
  console.log("** Copy these into frontend/src/config/contracts.ts **");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});