import { useState, useEffect, useCallback, useRef } from "react";
import { ethers } from "ethers";
import {
  Token,
  TOKENS,
  FACTORY_ADDRESS,
  ROUTER_ADDRESS,
  NATIVE_TOKEN,
} from "../config/contracts";
import { ROUTER_ABI, FACTORY_ABI, PAIR_ABI, ERC20_ABI } from "../config/abis";
import { ZERO_ADDRESS } from "../config/constants";

const SLIPPAGE_BPS = 50; // 0.50%
const DEADLINE_MINUTES = 30;

export type PoolInfo = {
  pairAddress: string;
  token0: string;
  token1: string;
  reserve0: string;
  reserve1: string;
  totalSupply: string;
  myLpBalance: string;
  myShare: string;
  myToken0: string;
  myToken1: string;
};

export type LiquidityState = {
  tokenA: Token;
  tokenB: Token;
  amountA: string;
  amountB: string;
  pairExists: boolean;
  poolInfo: PoolInfo | null;
  isLoadingPool: boolean;
  lpToRemove: string;
  removeAmountA: string;
  removeAmountB: string;
  isApproving: boolean;
  isAdding: boolean;
  isRemoving: boolean;
  needsApprovalA: boolean;
  needsApprovalB: boolean;
  needsLpApproval: boolean;
  error: string | null;
  txHash: string | null;
};

type Erc20Meta = { decimals: number; symbol: string };

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
    err?.message,
  ].filter(Boolean);

  const msg = String(candidates[0] || "");
  if (!msg) return null;

  if (msg.includes("execution reverted")) return msg;
  return msg;
}

export function useLiquidity(signer: ethers.Signer | null, address: string | null) {
  // Always prefer wrapped native on Igra to avoid router ETH paths
  const WRAPPED_NATIVE = TOKENS.kaWIKAS;

  const normalizeToken = useCallback(
    (t: Token) => {
      // If UI ever passes the native placeholder, we silently convert to wrapped native
      if (t.address === "NATIVE") return WRAPPED_NATIVE;
      return t;
    },
    [WRAPPED_NATIVE]
  );

  const [state, setState] = useState<LiquidityState>({
    // Default to wrapped native, not the native placeholder
    tokenA: WRAPPED_NATIVE,
    tokenB: TOKENS.kaUSDC,
    amountA: "",
    amountB: "",
    pairExists: false,
    poolInfo: null,
    isLoadingPool: false,
    lpToRemove: "",
    removeAmountA: "",
    removeAmountB: "",
    isApproving: false,
    isAdding: false,
    isRemoving: false,
    needsApprovalA: false,
    needsApprovalB: false,
    needsLpApproval: false,
    error: null,
    txHash: null,
  });

  // Cache ERC20 decimals/symbol from chain
  const erc20MetaCache = useRef<Record<string, Erc20Meta>>({});

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

  const getChainDeadline = useCallback(async () => {
    if (!signer?.provider) {
      const now = Math.floor(Date.now() / 1000);
      return now + DEADLINE_MINUTES * 60;
    }
    const block = await signer.provider.getBlock("latest");
    const chainNow = Number(block.timestamp);
    return chainNow + DEADLINE_MINUTES * 60;
  }, [signer]);

  // Fetch pool info (ERC20 / ERC20 only)
  useEffect(() => {
    const fetchPool = async () => {
      if (!signer || (FACTORY_ADDRESS as string) === ZERO_ADDRESS) return;

      setState((s) => ({ ...s, isLoadingPool: true }));

      try {
        const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);

        const tA = normalizeToken(state.tokenA);
        const tB = normalizeToken(state.tokenB);

        const pairAddress = await factory.getPair(tA.address, tB.address);
        const pairExists = pairAddress !== ethers.constants.AddressZero;

        if (!pairExists) {
          setState((s) => ({ ...s, pairExists: false, poolInfo: null, isLoadingPool: false }));
          return;
        }

        const pair = new ethers.Contract(pairAddress, PAIR_ABI, signer);
        const [reserve0, reserve1] = await pair.getReserves();
        const token0: string = await pair.token0();
        const token1: string = await pair.token1();
        const totalSupply: ethers.BigNumber = await pair.totalSupply();
        const myLpBalance: ethers.BigNumber = address ? await pair.balanceOf(address) : ethers.BigNumber.from(0);

        const isAFirst = tA.address.toLowerCase() === token0.toLowerCase();
        const resA = isAFirst ? reserve0 : reserve1;
        const resB = isAFirst ? reserve1 : reserve0;

        const decA = (await getErc20Meta(tA.address)).decimals;
        const decB = (await getErc20Meta(tB.address)).decimals;

        const myShare = totalSupply.gt(0)
          ? myLpBalance.mul(10000).div(totalSupply).toNumber() / 100
          : 0;

        const myTokenA = totalSupply.gt(0)
          ? ethers.utils.formatUnits(myLpBalance.mul(resA).div(totalSupply), decA)
          : "0";

        const myTokenB = totalSupply.gt(0)
          ? ethers.utils.formatUnits(myLpBalance.mul(resB).div(totalSupply), decB)
          : "0";

        const poolInfo: PoolInfo = {
          pairAddress,
          token0,
          token1,
          reserve0: ethers.utils.formatUnits(resA, decA),
          reserve1: ethers.utils.formatUnits(resB, decB),
          totalSupply: ethers.utils.formatEther(totalSupply),
          myLpBalance: ethers.utils.formatEther(myLpBalance),
          myShare: myShare.toFixed(4),
          myToken0: parseFloat(myTokenA).toFixed(6),
          myToken1: parseFloat(myTokenB).toFixed(6),
        };

        setState((s) => ({ ...s, pairExists: true, poolInfo, isLoadingPool: false }));
      } catch {
        setState((s) => ({ ...s, isLoadingPool: false }));
      }
    };

    fetchPool();
  }, [state.tokenA, state.tokenB, signer, address, normalizeToken, getErc20Meta]);

  // Auto quote amountB based on pool ratio
  useEffect(() => {
    if (!state.pairExists || !state.poolInfo || !isPositiveNumberString(state.amountA)) return;
    const { reserve0, reserve1 } = state.poolInfo;
    if (!isPositiveNumberString(reserve0)) return;

    const ratio = parseFloat(reserve1) / parseFloat(reserve0);
    setState((s) => ({ ...s, amountB: (parseFloat(s.amountA) * ratio).toFixed(6) }));
  }, [state.amountA, state.pairExists, state.poolInfo]);

  // Compute removal amounts
  useEffect(() => {
    if (!state.poolInfo || !isPositiveNumberString(state.lpToRemove)) return;
    const { reserve0, reserve1, totalSupply } = state.poolInfo;
    const share = parseFloat(state.lpToRemove) / parseFloat(totalSupply);
    setState((s) => ({
      ...s,
      removeAmountA: (parseFloat(reserve0) * share).toFixed(6),
      removeAmountB: (parseFloat(reserve1) * share).toFixed(6),
    }));
  }, [state.lpToRemove, state.poolInfo]);

  // Check approvals for tokenA/tokenB (always ERC20 now)
  useEffect(() => {
    const check = async () => {
      if (!signer || !address) return;
      if (!isPositiveNumberString(state.amountA) || !isPositiveNumberString(state.amountB)) return;

      const tA = normalizeToken(state.tokenA);
      const tB = normalizeToken(state.tokenB);

      try {
        const metaA = await getErc20Meta(tA.address);
        const cA = new ethers.Contract(tA.address, ERC20_ABI, signer);
        const amtA = ethers.utils.parseUnits(state.amountA, metaA.decimals);
        const allowanceA: ethers.BigNumber = await cA.allowance(address, ROUTER_ADDRESS);
        setState((s) => ({ ...s, needsApprovalA: allowanceA.lt(amtA) }));
      } catch {
        /* ignore */
      }

      try {
        const metaB = await getErc20Meta(tB.address);
        const cB = new ethers.Contract(tB.address, ERC20_ABI, signer);
        const amtB = ethers.utils.parseUnits(state.amountB, metaB.decimals);
        const allowanceB: ethers.BigNumber = await cB.allowance(address, ROUTER_ADDRESS);
        setState((s) => ({ ...s, needsApprovalB: allowanceB.lt(amtB) }));
      } catch {
        /* ignore */
      }
    };

    check();
  }, [state.amountA, state.amountB, state.tokenA, state.tokenB, signer, address, normalizeToken, getErc20Meta]);

  // Check LP approval
  useEffect(() => {
    const check = async () => {
      if (!signer || !address || !state.poolInfo) return;
      if (!isPositiveNumberString(state.lpToRemove)) return;

      try {
        const pair = new ethers.Contract(state.poolInfo.pairAddress, PAIR_ABI, signer);
        const amt = ethers.utils.parseEther(state.lpToRemove);
        const allowance: ethers.BigNumber = await pair.allowance(address, ROUTER_ADDRESS);
        setState((s) => ({ ...s, needsLpApproval: allowance.lt(amt) }));
      } catch {
        /* ignore */
      }
    };

    check();
  }, [state.lpToRemove, state.poolInfo, signer, address]);

  const setTokenA = useCallback(
    (t: Token) => {
      const nt = normalizeToken(t);
      setState((s) => ({ ...s, tokenA: nt, amountA: "", amountB: "", error: null, txHash: null }));
    },
    [normalizeToken]
  );

  const setTokenB = useCallback(
    (t: Token) => {
      const nt = normalizeToken(t);
      setState((s) => ({ ...s, tokenB: nt, amountA: "", amountB: "", error: null, txHash: null }));
    },
    [normalizeToken]
  );

  const setAmountA = useCallback((v: string) => {
    setState((s) => ({ ...s, amountA: v, error: null }));
  }, []);

  const setAmountB = useCallback((v: string) => {
    setState((s) => ({ ...s, amountB: v, error: null }));
  }, []);

  const setLpToRemove = useCallback((v: string) => {
    setState((s) => ({ ...s, lpToRemove: v, error: null }));
  }, []);

  const approveA = useCallback(async () => {
    if (!signer) return;
    setState((s) => ({ ...s, isApproving: true, error: null }));
    try {
      const tA = normalizeToken(state.tokenA);
      const c = new ethers.Contract(tA.address, ERC20_ABI, signer);
      const tx = await c.approve(ROUTER_ADDRESS, ethers.constants.MaxUint256);
      await tx.wait();
      setState((s) => ({ ...s, isApproving: false, needsApprovalA: false }));
    } catch (e: any) {
      setState((s) => ({
        ...s,
        isApproving: false,
        error: extractRevertReason(e) || "Approval failed",
      }));
    }
  }, [signer, state.tokenA, normalizeToken]);

  const approveB = useCallback(async () => {
    if (!signer) return;
    setState((s) => ({ ...s, isApproving: true, error: null }));
    try {
      const tB = normalizeToken(state.tokenB);
      const c = new ethers.Contract(tB.address, ERC20_ABI, signer);
      const tx = await c.approve(ROUTER_ADDRESS, ethers.constants.MaxUint256);
      await tx.wait();
      setState((s) => ({ ...s, isApproving: false, needsApprovalB: false }));
    } catch (e: any) {
      setState((s) => ({
        ...s,
        isApproving: false,
        error: extractRevertReason(e) || "Approval failed",
      }));
    }
  }, [signer, state.tokenB, normalizeToken]);

  const approveLp = useCallback(async () => {
    if (!signer || !state.poolInfo) return;
    setState((s) => ({ ...s, isApproving: true, error: null }));
    try {
      const pair = new ethers.Contract(state.poolInfo.pairAddress, PAIR_ABI, signer);
      const tx = await pair.approve(ROUTER_ADDRESS, ethers.constants.MaxUint256);
      await tx.wait();
      setState((s) => ({ ...s, isApproving: false, needsLpApproval: false }));
    } catch (e: any) {
      setState((s) => ({
        ...s,
        isApproving: false,
        error: extractRevertReason(e) || "Approval failed",
      }));
    }
  }, [signer, state.poolInfo]);

  const addLiquidity = useCallback(async () => {
    if (!signer || !address) return;
    if (!isPositiveNumberString(state.amountA) || !isPositiveNumberString(state.amountB)) return;

    setState((s) => ({ ...s, isAdding: true, error: null, txHash: null }));

    try {
      const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, signer);

      const tA = normalizeToken(state.tokenA);
      const tB = normalizeToken(state.tokenB);

      const metaA = await getErc20Meta(tA.address);
      const metaB = await getErc20Meta(tB.address);

      const amtA = ethers.utils.parseUnits(state.amountA, metaA.decimals);
      const amtB = ethers.utils.parseUnits(state.amountB, metaB.decimals);

      const amtAMin = applySlippageDown(amtA, SLIPPAGE_BPS);
      const amtBMin = applySlippageDown(amtB, SLIPPAGE_BPS);

      const dl = await getChainDeadline();

      // Preflight
      try {
        await router.callStatic.addLiquidity(
          tA.address,
          tB.address,
          amtA,
          amtB,
          amtAMin,
          amtBMin,
          address,
          dl
        );
      } catch (simErr: any) {
        throw new Error(extractRevertReason(simErr) || "addLiquidity reverted");
      }

      const tx = await router.addLiquidity(
        tA.address,
        tB.address,
        amtA,
        amtB,
        amtAMin,
        amtBMin,
        address,
        dl
      );

      const receipt = await tx.wait();

      setState((s) => ({
        ...s,
        isAdding: false,
        txHash: receipt.transactionHash,
        amountA: "",
        amountB: "",
      }));
    } catch (e: any) {
      const msg = extractRevertReason(e) || "Add liquidity failed";
      setState((s) => ({ ...s, isAdding: false, error: msg }));
    }
  }, [signer, address, state.amountA, state.amountB, state.tokenA, state.tokenB, normalizeToken, getErc20Meta, getChainDeadline]);

  const removeLiquidity = useCallback(async () => {
    if (!signer || !address || !state.poolInfo) return;
    if (!isPositiveNumberString(state.lpToRemove)) return;

    setState((s) => ({ ...s, isRemoving: true, error: null, txHash: null }));

    try {
      const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, signer);
      const dl = await getChainDeadline();

      const tA = normalizeToken(state.tokenA);
      const tB = normalizeToken(state.tokenB);

      const metaA = await getErc20Meta(tA.address);
      const metaB = await getErc20Meta(tB.address);

      const lpAmt = ethers.utils.parseEther(state.lpToRemove);

      const amtAMin = ethers.utils.parseUnits(
        (parseFloat(state.removeAmountA) * 0.995).toFixed(metaA.decimals),
        metaA.decimals
      );
      const amtBMin = ethers.utils.parseUnits(
        (parseFloat(state.removeAmountB) * 0.995).toFixed(metaB.decimals),
        metaB.decimals
      );

      // Preflight
      try {
        await router.callStatic.removeLiquidity(
          tA.address,
          tB.address,
          lpAmt,
          amtAMin,
          amtBMin,
          address,
          dl
        );
      } catch (simErr: any) {
        throw new Error(extractRevertReason(simErr) || "removeLiquidity reverted");
      }

      const tx = await router.removeLiquidity(
        tA.address,
        tB.address,
        lpAmt,
        amtAMin,
        amtBMin,
        address,
        dl
      );

      const receipt = await tx.wait();

      setState((s) => ({
        ...s,
        isRemoving: false,
        txHash: receipt.transactionHash,
        lpToRemove: "",
        removeAmountA: "",
        removeAmountB: "",
      }));
    } catch (e: any) {
      setState((s) => ({
        ...s,
        isRemoving: false,
        error: extractRevertReason(e) || "Remove liquidity failed",
      }));
    }
  }, [
    signer,
    address,
    state.poolInfo,
    state.lpToRemove,
    state.removeAmountA,
    state.removeAmountB,
    state.tokenA,
    state.tokenB,
    normalizeToken,
    getChainDeadline,
    getErc20Meta,
  ]);

  return {
    ...state,
    setTokenA,
    setTokenB,
    setAmountA,
    setAmountB,
    setLpToRemove,
    approveA,
    approveB,
    approveLp,
    addLiquidity,
    removeLiquidity,
  };
}