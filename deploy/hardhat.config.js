require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.5.16", // UniswapV2Core (Factory, Pair)
        settings: {
          optimizer: {
            enabled: true,
            runs: 999999,
          },
        },
      },
      {
        version: "0.6.6", // UniswapV2Periphery (Router02)
        settings: {
          optimizer: {
            enabled: true,
            runs: 999999,
          },
        },
      },
    ],
  },
  networks: {
    galleon: {
      url: "https://galleon-testnet.igralabs.com:8545",
      chainId: 38836,
      accounts: ["0xeda228e120390b4875bcafb92cd85f6426753468e370ad7c618364bf398683b7"],
      gasPrice: 2000000000000,
    },
  },
};
