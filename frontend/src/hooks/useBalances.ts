import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { TOKEN_LIST, NATIVE_TOKEN } from "../config/contracts";
import { ERC20_ABI } from "../config/abis";

export type Balances = Record<string, string>;

export function useBalances(
  provider: ethers.providers.Web3Provider | null,
  address: string | null
): Balances {
  const [balances, setBalances] = useState<Balances>({});

  useEffect(() => {
    if (!provider || !address) {
      setBalances({});
      return;
    }

    const fetch = async () => {
      try {
        const results: Balances = {};

        // Native iKAS balance
        const nativeBal = await provider.getBalance(address);
        results["NATIVE"] = parseFloat(ethers.utils.formatEther(nativeBal)).toFixed(4);

        // ERC20 balances
        await Promise.all(
          TOKEN_LIST.map(async (token) => {
            try {
              const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
              const bal = await contract.balanceOf(address);
              results[token.address] = parseFloat(
                ethers.utils.formatUnits(bal, token.decimals)
              ).toFixed(4);
            } catch {
              results[token.address] = "0";
            }
          })
        );

        setBalances(results);
      } catch (e) {
        console.error("Balance fetch error", e);
      }
    };

    fetch();
    const interval = setInterval(fetch, 10000);
    return () => clearInterval(interval);
  }, [provider, address]);

  return balances;
}
