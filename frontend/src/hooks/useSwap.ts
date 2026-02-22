import { useState, useCallback, useEffect, useRef } from "react";
import { ethers } from "ethers";
import { Token, TOKENS, ROUTER_ADDRESS, NATIVE_TOKEN } from "../config/contracts";
import { ROUTER_ABI, ERC20_ABI } from "../config/abis";
import { ZERO_ADDRESS } from "../config/constants";

const SLIPPAGE_BPS = 50; // 0.50%
const DEADLINE_MINUTES = 30;

type Erc20Meta = { decimals: number; symbol: string };

const WETH_LIKE_ABI = [
  "function deposit() payable",
  "function withdraw(uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

export type SwapState = {
  tokenIn: Token;
  tokenOut: Token;
  amountIn: string;
  amountOut: string;
  isLoading: boolean;
  isApproving: boolean;
  isSwapping: boolean;
  needsApproval: boolean;
  error: string | null;
  txHash: string | null;
};

function isPositiveNumberString(v: string) {
  if (!v) return false;
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
}

function applySlippageDown(amount: ethers.BigNumber, bps: number) {
  return amount.mul(10000 - bps).div(10000);
}

function extractRevertReason(err: any): string | null {
  const candidates = [
    err?.reason,
    err?.error?.reason,
    err?.error?.message,
    err?.data?.message,
    err?.data,
    err?.message,
  ].filter(Boolean);

  const msg = String(candidates[0] || "");
  if (!msg) return null;

  if (msg.includes("execution reverted")) return msg;
  return msg;
}

export function useSwap(signer: ethers.Signer | null, address: string | null) {
  const [state, setState] = useState<SwapState>({
    tokenIn: NATIVE_TOKEN,
    tokenOut: TOKENS.kaUSDC,
    amountIn: "",
    amountOut: "",
    isLoading: false,
    isApproving: false,
    isSwapping: false,
    needsApproval: false,
    error: null,
    txHash: null,
  });

  const erc20MetaCache = useRef<Record<string, Erc20Meta>>({});

  const normalizeToken = useCallback((t: Token): Token => {
    // Router swap paths must be ERC20 addresses only.
    // Native iKAS is represented by wrapped kaWIKAS.
    return t.address === "NATIVE" ? TOKENS.kaWIKAS : t;
  }, []);

  const getErc20Meta = useCallback(
    async (tokenAddress: string): Promise<Erc20Meta> => {
      const key = tokenAddress.toLowerCase();
      const cached = erc20MetaCache.current[key];
      if (cached) return cached;

      if (!signer) {
        const fallback = { decimals: 18, symbol: "ERC20" };
        erc20MetaCache.current[key] = fallback;
        return fallback;
      }

      const c = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
      const [decimalsBn, symbol] = await Promise.all([c.decimals(), c.symbol()]);
      const meta = { decimals: Number(decimalsBn), symbol: String(symbol) };
      erc20MetaCache.current[key] = meta;
      return meta;
    },
    [signer]
  );

  const getPath = useCallback(
    (tokenIn: Token, tokenOut: Token) => {
      const a = normalizeToken(tokenIn).address;
      const b = normalizeToken(tokenOut).address;
      return [a, b];
    },
    [normalizeToken]
  );

  const getChainDeadline = useCallback(async () => {
    if (!signer?.provider) {
      const now = Math.floor(Date.now() / 1000);
      return now + DEADLINE_MINUTES * 60;
    }
    const block = await signer.provider.getBlock("latest");
    const chainNow = Number(block.timestamp);
    const dl = chainNow + DEADLINE_MINUTES * 60;

    console.log(
      `Swap chain deadline: ${dl} = ${new Date(dl * 1000).toISOString()} | chainNow=${chainNow} (${new Date(
        chainNow * 1000
      ).toISOString()})`
    );

    return dl;
  }, [signer]);

  const checkNeedsApproval = useCallback(
    async (tokenIn: Token, amountInStr: string) => {
      if (!signer || !address) return false;
      if (!isPositiveNumberString(amountInStr)) return false;

      const inTok = normalizeToken(tokenIn); // may become kaWIKAS
      const metaIn = await getErc20Meta(inTok.address);
      const amtIn = ethers.utils.parseUnits(amountInStr, metaIn.decimals);

      const c = new ethers.Contract(inTok.address, ERC20_ABI, signer);
      const allowance: ethers.BigNumber = await c.allowance(address, ROUTER_ADDRESS);
      return allowance.lt(amtIn);
    },
    [signer, address, normalizeToken, getErc20Meta]
  );

  useEffect(() => {
    const fetchQuote = async () => {
      if (!signer) {
        setState((s) => ({ ...s, amountOut: "" }));
        return;
      }
      if (!isPositiveNumberString(state.amountIn)) {
        setState((s) => ({ ...s, amountOut: "" }));
        return;
      }
      if ((ROUTER_ADDRESS as string) === ZERO_ADDRESS) {
        setState((s) => ({
          ...s,
          error: "Router not deployed yet. Update ROUTER_ADDRESS in config/contracts.ts",
          amountOut: "",
        }));
        return;
      }

      setState((s) => ({ ...s, isLoading: true, error: null }));

      try {
        const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, signer);

        const inTok = normalizeToken(state.tokenIn);
        const outTok = normalizeToken(state.tokenOut);

        const metaIn = await getErc20Meta(inTok.address);
        const metaOut = await getErc20Meta(outTok.address);

        const amountIn = ethers.utils.parseUnits(state.amountIn, metaIn.decimals);
        const path = getPath(state.tokenIn, state.tokenOut);

        const amounts: ethers.BigNumber[] = await router.getAmountsOut(amountIn, path);
        const expectedOut = amounts[amounts.length - 1];

        const outStr = ethers.utils.formatUnits(expectedOut, metaOut.decimals);

        const needsApproval = await checkNeedsApproval(state.tokenIn, state.amountIn);

        setState((s) => ({
          ...s,
          amountOut: parseFloat(outStr).toFixed(6),
          isLoading: false,
          needsApproval,
        }));
      } catch (err: any) {
        setState((s) => ({
          ...s,
          amountOut: "",
          isLoading: false,
          needsApproval: false,
          error: extractRevertReason(err) || "No liquidity for this pair",
        }));
      }
    };

    const t = setTimeout(fetchQuote, 500);
    return () => clearTimeout(t);
  }, [state.amountIn, state.tokenIn, state.tokenOut, signer, normalizeToken, getErc20Meta, getPath, checkNeedsApproval]);

  const setTokenIn = useCallback((token: Token) => {
    setState((s) => ({ ...s, tokenIn: token, amountIn: "", amountOut: "", error: null, txHash: null }));
  }, []);

  const setTokenOut = useCallback((token: Token) => {
    setState((s) => ({ ...s, tokenOut: token, amountIn: "", amountOut: "", error: null, txHash: null }));
  }, []);

  const setAmountIn = useCallback((value: string) => {
    setState((s) => ({ ...s, amountIn: value, error: null, txHash: null }));
  }, []);

  const flipTokens = useCallback(() => {
    setState((s) => ({
      ...s,
      tokenIn: s.tokenOut,
      tokenOut: s.tokenIn,
      amountIn: s.amountOut,
      amountOut: "",
      error: null,
      txHash: null,
    }));
  }, []);

  const approve = useCallback(async () => {
    if (!signer || !address) return;

    setState((s) => ({ ...s, isApproving: true, error: null }));

    try {
      const inTok = normalizeToken(state.tokenIn); // approve kaWIKAS if native selected
      const tokenContract = new ethers.Contract(inTok.address, ERC20_ABI, signer);
      const tx = await tokenContract.approve(ROUTER_ADDRESS, ethers.constants.MaxUint256);
      await tx.wait();

      setState((s) => ({ ...s, isApproving: false, needsApproval: false }));
    } catch (err: any) {
      setState((s) => ({
        ...s,
        isApproving: false,
        error: extractRevertReason(err) || "Approval failed",
      }));
    }
  }, [signer, address, state.tokenIn, normalizeToken]);

  const swap = useCallback(async () => {
    if (!signer || !address) return;
    if (!isPositiveNumberString(state.amountIn)) return;

    setState((s) => ({ ...s, isSwapping: true, error: null, txHash: null }));

    try {
      const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, signer);

      const originalInIsNative = state.tokenIn.address === "NATIVE";
      const originalOutIsNative = state.tokenOut.address === "NATIVE";

      const inTok = normalizeToken(state.tokenIn);
      const outTok = normalizeToken(state.tokenOut);

      const metaIn = await getErc20Meta(inTok.address);
      const metaOut = await getErc20Meta(outTok.address);

      const amountIn = ethers.utils.parseUnits(state.amountIn, metaIn.decimals);
      const path = [inTok.address, outTok.address];

      // Quote + compute minOut from chain quoted output
      const amounts: ethers.BigNumber[] = await router.getAmountsOut(amountIn, path);
      const expectedOut = amounts[amounts.length - 1];
      const amountOutMin = applySlippageDown(expectedOut, SLIPPAGE_BPS);

      // Deadline from chain time (fixes EXPIRED)
      const dl = await getChainDeadline();

      // If input is native, wrap to wIKAS first
      if (originalInIsNative) {
        const wikas = new ethers.Contract(TOKENS.kaWIKAS.address, WETH_LIKE_ABI, signer);
        console.log("Wrapping iKAS to wIKAS:", ethers.utils.formatEther(amountIn));
        const wrapTx = await wikas.deposit({ value: amountIn });
        await wrapTx.wait();
      }

      // Ensure approval for inTok
      const c = new ethers.Contract(inTok.address, ERC20_ABI, signer);
      const allowance: ethers.BigNumber = await c.allowance(address, ROUTER_ADDRESS);
      if (allowance.lt(amountIn)) {
        throw new Error("Allowance too low. Please approve first.");
      }

      // If output is native, track wIKAS balance delta for unwrap
      let wikasBefore: ethers.BigNumber | null = null;
      if (originalOutIsNative) {
        const wikas = new ethers.Contract(TOKENS.kaWIKAS.address, WETH_LIKE_ABI, signer);
        wikasBefore = await wikas.balanceOf(address);
      }

      console.log("🚀 swapExactTokensForTokens params");
      console.log("in", metaIn.symbol, inTok.address);
      console.log("out", metaOut.symbol, outTok.address);
      console.log("amountIn", ethers.utils.formatUnits(amountIn, metaIn.decimals));
      console.log("expectedOut", ethers.utils.formatUnits(expectedOut, metaOut.decimals));
      console.log("amountOutMin", ethers.utils.formatUnits(amountOutMin, metaOut.decimals));
      console.log("to", address);
      console.log("deadline", dl, new Date(dl * 1000).toISOString());
      console.log("path", path);

      // Preflight
      await router.callStatic.swapExactTokensForTokens(amountIn, amountOutMin, path, address, dl);

      const tx = await router.swapExactTokensForTokens(amountIn, amountOutMin, path, address, dl);
      console.log("✅ swap tx sent:", tx.hash);

      const receipt = await tx.wait();

      // Unwrap if output is native
      if (originalOutIsNative) {
        const wikas = new ethers.Contract(TOKENS.kaWIKAS.address, WETH_LIKE_ABI, signer);
        const after = await wikas.balanceOf(address);
        const before = wikasBefore || ethers.BigNumber.from(0);
        const delta = after.sub(before);

        if (delta.gt(0)) {
          console.log("Unwrapping wIKAS to iKAS:", ethers.utils.formatEther(delta));
          const unwrapTx = await wikas.withdraw(delta);
          await unwrapTx.wait();
        }
      }

      setState((s) => ({
        ...s,
        isSwapping: false,
        txHash: receipt.transactionHash,
        amountIn: "",
        amountOut: "",
      }));
    } catch (err: any) {
      const msg = extractRevertReason(err) || "Swap failed";
      console.error("Swap error:", err);
      setState((s) => ({ ...s, isSwapping: false, error: msg }));
    }
  }, [signer, address, state, normalizeToken, getErc20Meta, getChainDeadline]);

  return {
    ...state,
    setTokenIn,
    setTokenOut,
    setAmountIn,
    flipTokens,
    approve,
    swap,
  };
}
