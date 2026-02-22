import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { Token, TOKENS, FACTORY_ADDRESS, ROUTER_ADDRESS, NATIVE_TOKEN } from "../config/contracts";
import { ROUTER_ABI, FACTORY_ABI, PAIR_ABI, ERC20_ABI } from "../config/abis";

const DEADLINE_MINUTES = 20;
const SLIPPAGE_BPS = 50;
const GAS_PRICE = ethers.utils.parseUnits("2000", "gwei");

function deadline() {
  return Math.floor(Date.now() / 1000) + DEADLINE_MINUTES * 60;
}

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

export function useLiquidity(signer: ethers.Signer | null, address: string | null) {
  const [state, setState] = useState<LiquidityState>({
    tokenA: NATIVE_TOKEN,
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

  const getTokenAddr = (t: Token) =>
    t.address === "NATIVE" ? TOKENS.kaWIKAS.address : t.address;

  const isPoolEmpty = (poolInfo: PoolInfo | null) =>
    !poolInfo || parseFloat(poolInfo.reserve0) === 0 || parseFloat(poolInfo.reserve1) === 0;

  useEffect(() => {
    const fetchPool = async () => {
      if (!signer) return;
      setState(s => ({ ...s, isLoadingPool: true }));
      try {
        const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
        const addrA = getTokenAddr(state.tokenA);
        const addrB = getTokenAddr(state.tokenB);
        const pairAddress = await factory.getPair(addrA, addrB);
        const pairExists = pairAddress !== ethers.constants.AddressZero;

        if (!pairExists) {
          setState(s => ({ ...s, pairExists: false, poolInfo: null, isLoadingPool: false }));
          return;
        }

        const pair = new ethers.Contract(pairAddress, PAIR_ABI, signer);
        const [reserve0, reserve1] = await pair.getReserves();
        const token0: string = await pair.token0();
        const totalSupply: ethers.BigNumber = await pair.totalSupply();
        const myLpBalance: ethers.BigNumber = address
          ? await pair.balanceOf(address)
          : ethers.BigNumber.from(0);

        const isAFirst = addrA.toLowerCase() === token0.toLowerCase();
        const resA = isAFirst ? reserve0 : reserve1;
        const resB = isAFirst ? reserve1 : reserve0;

        const myShare = totalSupply.gt(0)
          ? (myLpBalance.mul(10000).div(totalSupply).toNumber() / 100)
          : 0;

        const myTokenA = totalSupply.gt(0)
          ? ethers.utils.formatUnits(myLpBalance.mul(resA).div(totalSupply), state.tokenA.decimals)
          : "0";
        const myTokenB = totalSupply.gt(0)
          ? ethers.utils.formatUnits(myLpBalance.mul(resB).div(totalSupply), state.tokenB.decimals)
          : "0";

        const poolInfo: PoolInfo = {
          pairAddress,
          token0,
          token1: addrA.toLowerCase() === token0.toLowerCase() ? addrB : addrA,
          reserve0: ethers.utils.formatUnits(resA, state.tokenA.decimals),
          reserve1: ethers.utils.formatUnits(resB, state.tokenB.decimals),
          totalSupply: ethers.utils.formatEther(totalSupply),
          myLpBalance: ethers.utils.formatEther(myLpBalance),
          myShare: myShare.toFixed(4),
          myToken0: parseFloat(myTokenA).toFixed(6),
          myToken1: parseFloat(myTokenB).toFixed(6),
        };

        setState(s => ({ ...s, pairExists: true, poolInfo, isLoadingPool: false }));
      } catch (e) {
        setState(s => ({ ...s, isLoadingPool: false }));
      }
    };
    fetchPool();
  }, [state.tokenA, state.tokenB, signer, address]);

  // Auto-calculate tokenB based on pool ratio — skip if pool is empty
  useEffect(() => {
    if (!state.pairExists || !state.poolInfo || !state.amountA || parseFloat(state.amountA) <= 0) return;
    const { reserve0, reserve1 } = state.poolInfo;
    // Don't auto-calculate on empty pool — let user set initial price freely
    if (parseFloat(reserve0) === 0 || parseFloat(reserve1) === 0) return;
    const ratio = parseFloat(reserve1) / parseFloat(reserve0);
    setState(s => ({ ...s, amountB: (parseFloat(s.amountA) * ratio).toFixed(6) }));
  }, [state.amountA, state.pairExists, state.poolInfo]);

  useEffect(() => {
    if (!state.poolInfo || !state.lpToRemove || parseFloat(state.lpToRemove) <= 0) return;
    const { reserve0, reserve1, totalSupply } = state.poolInfo;
    const share = parseFloat(state.lpToRemove) / parseFloat(totalSupply);
    setState(s => ({
      ...s,
      removeAmountA: (parseFloat(reserve0) * share).toFixed(6),
      removeAmountB: (parseFloat(reserve1) * share).toFixed(6),
    }));
  }, [state.lpToRemove, state.poolInfo]);

  useEffect(() => {
    const check = async () => {
      if (!signer || !address || !state.amountA || !state.amountB) return;
      if (state.tokenA.address !== "NATIVE") {
        try {
          const c = new ethers.Contract(state.tokenA.address, ERC20_ABI, signer);
          const amt = ethers.utils.parseUnits(state.amountA || "0", state.tokenA.decimals);
          const allowance: ethers.BigNumber = await c.allowance(address, ROUTER_ADDRESS);
          setState(s => ({ ...s, needsApprovalA: allowance.lt(amt) }));
        } catch { /* ignore */ }
      } else {
        setState(s => ({ ...s, needsApprovalA: false }));
      }
      if (state.tokenB.address !== "NATIVE") {
        try {
          const c = new ethers.Contract(state.tokenB.address, ERC20_ABI, signer);
          const amt = ethers.utils.parseUnits(state.amountB || "0", state.tokenB.decimals);
          const allowance: ethers.BigNumber = await c.allowance(address, ROUTER_ADDRESS);
          setState(s => ({ ...s, needsApprovalB: allowance.lt(amt) }));
        } catch { /* ignore */ }
      } else {
        setState(s => ({ ...s, needsApprovalB: false }));
      }
    };
    check();
  }, [state.amountA, state.amountB, state.tokenA, state.tokenB, signer, address]);

  useEffect(() => {
    const check = async () => {
      if (!signer || !address || !state.poolInfo || !state.lpToRemove) return;
      try {
        const pair = new ethers.Contract(state.poolInfo.pairAddress, PAIR_ABI, signer);
        const amt = ethers.utils.parseEther(state.lpToRemove);
        const allowance: ethers.BigNumber = await pair.allowance(address, ROUTER_ADDRESS);
        setState(s => ({ ...s, needsLpApproval: allowance.lt(amt) }));
      } catch { /* ignore */ }
    };
    check();
  }, [state.lpToRemove, state.poolInfo, signer, address]);

  const setTokenA = useCallback((t: Token) => {
    setState(s => ({ ...s, tokenA: t, amountA: "", amountB: "", error: null, txHash: null }));
  }, []);

  const setTokenB = useCallback((t: Token) => {
    setState(s => ({ ...s, tokenB: t, amountA: "", amountB: "", error: null, txHash: null }));
  }, []);

  const setAmountA = useCallback((v: string) => {
    setState(s => ({ ...s, amountA: v, error: null }));
  }, []);

  const setAmountB = useCallback((v: string) => {
    setState(s => ({ ...s, amountB: v, error: null }));
  }, []);

  const setLpToRemove = useCallback((v: string) => {
    setState(s => ({ ...s, lpToRemove: v, error: null }));
  }, []);

  const approveA = useCallback(async () => {
    if (!signer || state.tokenA.address === "NATIVE") return;
    setState(s => ({ ...s, isApproving: true, error: null }));
    try {
      const c = new ethers.Contract(state.tokenA.address, ERC20_ABI, signer);
      const tx = await c.approve(ROUTER_ADDRESS, ethers.constants.MaxUint256, { gasPrice: GAS_PRICE });
      await tx.wait();
      setState(s => ({ ...s, isApproving: false, needsApprovalA: false }));
    } catch (e: any) {
      setState(s => ({ ...s, isApproving: false, error: e?.reason || e?.message || "Approval failed" }));
    }
  }, [signer, state.tokenA]);

  const approveB = useCallback(async () => {
    if (!signer || state.tokenB.address === "NATIVE") return;
    setState(s => ({ ...s, isApproving: true, error: null }));
    try {
      const c = new ethers.Contract(state.tokenB.address, ERC20_ABI, signer);
      const tx = await c.approve(ROUTER_ADDRESS, ethers.constants.MaxUint256, { gasPrice: GAS_PRICE });
      await tx.wait();
      setState(s => ({ ...s, isApproving: false, needsApprovalB: false }));
    } catch (e: any) {
      setState(s => ({ ...s, isApproving: false, error: e?.reason || e?.message || "Approval failed" }));
    }
  }, [signer, state.tokenB]);

  const approveLp = useCallback(async () => {
    if (!signer || !state.poolInfo) return;
    setState(s => ({ ...s, isApproving: true, error: null }));
    try {
      const pair = new ethers.Contract(state.poolInfo.pairAddress, PAIR_ABI, signer);
      const tx = await pair.approve(ROUTER_ADDRESS, ethers.constants.MaxUint256, { gasPrice: GAS_PRICE });
      await tx.wait();
      setState(s => ({ ...s, isApproving: false, needsLpApproval: false }));
    } catch (e: any) {
      setState(s => ({ ...s, isApproving: false, error: e?.reason || e?.message || "Approval failed" }));
    }
  }, [signer, state.poolInfo]);

  const addLiquidity = useCallback(async () => {
    if (!signer || !address || !state.amountA || !state.amountB) return;
    setState(s => ({ ...s, isAdding: true, error: null, txHash: null }));
    try {
      const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, signer);
      const dl = deadline();
      const isNativeA = state.tokenA.address === "NATIVE";
      const isNativeB = state.tokenB.address === "NATIVE";
      const emptyPool = isPoolEmpty(state.poolInfo);
      let tx;

      if (isNativeA) {
        const amtToken = ethers.utils.parseUnits(state.amountB, state.tokenB.decimals);
        const amtETH = ethers.utils.parseEther(state.amountA);
        // On empty pool, set mins to 0 to allow free price setting
        const amtTokenMin = emptyPool ? ethers.BigNumber.from(0) : amtToken.mul(10000 - SLIPPAGE_BPS).div(10000);
        const amtETHMin = emptyPool ? ethers.BigNumber.from(0) : amtETH.mul(10000 - SLIPPAGE_BPS).div(10000);
        tx = await router.addLiquidityETH(
          state.tokenB.address, amtToken, amtTokenMin, amtETHMin, address, dl,
          { value: amtETH, gasPrice: GAS_PRICE }
        );
      } else if (isNativeB) {
        const amtToken = ethers.utils.parseUnits(state.amountA, state.tokenA.decimals);
        const amtETH = ethers.utils.parseEther(state.amountB);
        const amtTokenMin = emptyPool ? ethers.BigNumber.from(0) : amtToken.mul(10000 - SLIPPAGE_BPS).div(10000);
        const amtETHMin = emptyPool ? ethers.BigNumber.from(0) : amtETH.mul(10000 - SLIPPAGE_BPS).div(10000);
        tx = await router.addLiquidityETH(
          state.tokenA.address, amtToken, amtTokenMin, amtETHMin, address, dl,
          { value: amtETH, gasPrice: GAS_PRICE }
        );
      } else {
        const amtA = ethers.utils.parseUnits(state.amountA, state.tokenA.decimals);
        const amtB = ethers.utils.parseUnits(state.amountB, state.tokenB.decimals);
        const amtAMin = emptyPool ? ethers.BigNumber.from(0) : amtA.mul(10000 - SLIPPAGE_BPS).div(10000);
        const amtBMin = emptyPool ? ethers.BigNumber.from(0) : amtB.mul(10000 - SLIPPAGE_BPS).div(10000);
        tx = await router.addLiquidity(
          state.tokenA.address, state.tokenB.address,
          amtA, amtB, amtAMin, amtBMin, address, dl,
          { gasPrice: GAS_PRICE }
        );
      }

      const receipt = await tx.wait();
      setState(s => ({
        ...s, isAdding: false,
        txHash: receipt.transactionHash,
        amountA: "", amountB: "",
      }));
    } catch (e: any) {
      setState(s => ({ ...s, isAdding: false, error: e?.reason || e?.message || "Add liquidity failed" }));
    }
  }, [signer, address, state]);

  const removeLiquidity = useCallback(async () => {
    if (!signer || !address || !state.lpToRemove || !state.poolInfo) return;
    setState(s => ({ ...s, isRemoving: true, error: null, txHash: null }));
    try {
      const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, signer);
      const dl = deadline();
      const lpAmt = ethers.utils.parseEther(state.lpToRemove);
      const isNativeA = state.tokenA.address === "NATIVE";
      const isNativeB = state.tokenB.address === "NATIVE";

      // Use BigNumber math for min amounts — avoids float rounding reverts
      const pair = new ethers.Contract(state.poolInfo.pairAddress, PAIR_ABI, signer);
      const [res0, res1] = await pair.getReserves();
      const totalSupply: ethers.BigNumber = await pair.totalSupply();
      const token0: string = await pair.token0();
      const addrA = getTokenAddr(state.tokenA);
      const isAFirst = addrA.toLowerCase() === token0.toLowerCase();
      const resA = isAFirst ? res0 : res1;
      const resB = isAFirst ? res1 : res0;
      const expectedA = lpAmt.mul(resA).div(totalSupply);
      const expectedB = lpAmt.mul(resB).div(totalSupply);
      const minA = expectedA.mul(10000 - SLIPPAGE_BPS).div(10000);
      const minB = expectedB.mul(10000 - SLIPPAGE_BPS).div(10000);

      let tx;

      if (isNativeA || isNativeB) {
        const tokenAddr = isNativeA ? state.tokenB.address : state.tokenA.address;
        const minToken = isNativeA ? minB : minA;
        tx = await router.removeLiquidityETH(
          tokenAddr, lpAmt, minToken, 0, address, dl,
          { gasPrice: GAS_PRICE }
        );
      } else {
        tx = await router.removeLiquidity(
          state.tokenA.address, state.tokenB.address,
          lpAmt, minA, minB, address, dl,
          { gasPrice: GAS_PRICE }
        );
      }

      const receipt = await tx.wait();
      setState(s => ({
        ...s, isRemoving: false,
        txHash: receipt.transactionHash,
        lpToRemove: "", removeAmountA: "", removeAmountB: "",
      }));
    } catch (e: any) {
      setState(s => ({ ...s, isRemoving: false, error: e?.reason || e?.message || "Remove liquidity failed" }));
    }
  }, [signer, address, state]);

  return {
    ...state,
    setTokenA, setTokenB, setAmountA, setAmountB, setLpToRemove,
    approveA, approveB, approveLp,
    addLiquidity, removeLiquidity,
  };
}
