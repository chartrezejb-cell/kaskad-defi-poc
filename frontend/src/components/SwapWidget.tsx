import React, { useState } from "react";
import { Token, TOKEN_LIST, NATIVE_TOKEN, GALLEON_CHAIN } from "../config/contracts";
import { useSwap } from "../hooks/useSwap";
import { useBalances } from "../hooks/useBalances";
import { WalletState } from "../hooks/useWallet";

type Props = {
  wallet: WalletState;
  onConnect: () => void;
  onSwitchNetwork: () => void;
  /** When true, renders as a self-contained widget with its own wallet state.
   *  Use this when embedding directly into the Kaskad dApp as a component. */
  embedded?: boolean;
};

type TokenModalProps = {
  tokens: Token[];
  balances: Record<string, string>;
  selected: Token;
  onSelect: (t: Token) => void;
  onClose: () => void;
  excludeAddress?: string;
};

function TokenModal({ tokens, balances, selected, onSelect, onClose, excludeAddress }: TokenModalProps) {
  const [search, setSearch] = useState("");

  const filtered = [NATIVE_TOKEN, ...tokens].filter(
    (t) =>
      t.address !== excludeAddress &&
      (t.symbol.toLowerCase().includes(search.toLowerCase()) ||
        t.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>Select Token</span>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <input
          className="search-input"
          placeholder="Search token..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <div className="token-list">
          {filtered.map((token) => {
            const bal = balances[token.address] || "0";
            const isSelected = token.address === selected.address;
            return (
              <button
                key={token.address}
                className={`token-row ${isSelected ? "token-row--selected" : ""}`}
                onClick={() => { onSelect(token); onClose(); }}
              >
                <div className="token-icon">{token.symbol.slice(0, 2)}</div>
                <div className="token-info">
                  <span className="token-symbol">{token.symbol}</span>
                  <span className="token-name">{token.name}</span>
                </div>
                <span className="token-balance">{bal}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function SwapWidget({ wallet, onConnect, onSwitchNetwork }: Props) {
  const {
    tokenIn, tokenOut, amountIn, amountOut,
    isLoading, isApproving, isSwapping, needsApproval,
    error, txHash,
    setTokenIn, setTokenOut, setAmountIn, flipTokens, approve, swap,
  } = useSwap(wallet.signer, wallet.address);

  const balances = useBalances(wallet.provider, wallet.address);

  const [showInModal, setShowInModal] = useState(false);
  const [showOutModal, setShowOutModal] = useState(false);

  const balIn = balances[tokenIn.address] || "0";
  const balOut = balances[tokenOut.address] || "0";

  const handleMaxIn = () => {
    setAmountIn(balIn);
  };

  const priceImpact = amountIn && amountOut
    ? null // simplified - full calc needs reserves
    : null;

  const canSwap =
    wallet.address &&
    wallet.isCorrectNetwork &&
    amountIn &&
    parseFloat(amountIn) > 0 &&
    amountOut &&
    !isLoading &&
    !isSwapping &&
    !needsApproval;

  return (
    <div className="swap-widget">
      <div className="swap-header">
        <span className="swap-title">Swap</span>
        <div className="swap-settings">
          <span className="slippage-badge">0.5% slippage</span>
        </div>
      </div>

      {/* Token In */}
      <div className="token-box">
        <div className="token-box-top">
          <button className="token-selector" onClick={() => setShowInModal(true)}>
            <div className="token-selector-icon">{tokenIn.symbol.slice(0, 2)}</div>
            <span>{tokenIn.symbol}</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          <input
            className="amount-input"
            type="number"
            placeholder="0.0"
            value={amountIn}
            onChange={(e) => setAmountIn(e.target.value)}
            min="0"
          />
        </div>
        <div className="token-box-bottom">
          <span className="balance-label">
            Balance: <span className="balance-value">{balIn}</span>
          </span>
          {wallet.address && (
            <button className="max-btn" onClick={handleMaxIn}>MAX</button>
          )}
        </div>
      </div>

      {/* Flip button */}
      <div className="flip-row">
        <button className="flip-btn" onClick={flipTokens} title="Flip tokens">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M5 3L5 15M5 15L2 12M5 15L8 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M13 15L13 3M13 3L10 6M13 3L16 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Token Out */}
      <div className="token-box token-box--out">
        <div className="token-box-top">
          <button className="token-selector" onClick={() => setShowOutModal(true)}>
            <div className="token-selector-icon">{tokenOut.symbol.slice(0, 2)}</div>
            <span>{tokenOut.symbol}</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          <div className={`amount-display ${isLoading ? "amount-display--loading" : ""}`}>
            {isLoading ? (
              <span className="loading-dots">···</span>
            ) : (
              amountOut || "0.0"
            )}
          </div>
        </div>
        <div className="token-box-bottom">
          <span className="balance-label">
            Balance: <span className="balance-value">{balOut}</span>
          </span>
        </div>
      </div>

      {/* Swap details */}
      {amountIn && amountOut && !isLoading && (
        <div className="swap-details">
          <div className="detail-row">
            <span className="detail-label">Rate</span>
            <span className="detail-value">
              1 {tokenIn.symbol} ≈ {(parseFloat(amountOut) / parseFloat(amountIn)).toFixed(6)} {tokenOut.symbol}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Min. received</span>
            <span className="detail-value">
              {(parseFloat(amountOut) * 0.995).toFixed(6)} {tokenOut.symbol}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Fee</span>
            <span className="detail-value">0.3%</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="error-box">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="#f97066" strokeWidth="1.2"/>
            <path d="M7 4v3.5M7 9.5v.5" stroke="#f97066" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          {error}
        </div>
      )}

      {/* Tx success */}
      {txHash && (
        <div className="success-box">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="#4ade80" strokeWidth="1.2"/>
            <path d="M4.5 7L6.5 9L9.5 5" stroke="#4ade80" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Swap complete!{" "}
          <a
            href={`${GALLEON_CHAIN.explorerUrl}/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="tx-link"
          >
            View on explorer ↗
          </a>
        </div>
      )}

      {/* Action buttons */}
      {!wallet.address ? (
        <button className="action-btn" onClick={onConnect}>
          Connect Wallet
        </button>
      ) : !wallet.isCorrectNetwork ? (
        <button className="action-btn action-btn--warning" onClick={onSwitchNetwork}>
          Switch to Galleon Testnet
        </button>
      ) : needsApproval ? (
        <button
          className="action-btn"
          onClick={approve}
          disabled={isApproving}
        >
          {isApproving ? "Approving..." : `Approve ${tokenIn.symbol}`}
        </button>
      ) : (
        <button
          className="action-btn"
          onClick={swap}
          disabled={!canSwap}
        >
          {isSwapping ? "Swapping..." : !amountIn ? "Enter amount" : !amountOut ? "Insufficient liquidity" : "Swap"}
        </button>
      )}

      {/* Token modals */}
      {showInModal && (
        <TokenModal
          tokens={TOKEN_LIST}
          balances={balances}
          selected={tokenIn}
          onSelect={setTokenIn}
          onClose={() => setShowInModal(false)}
          excludeAddress={tokenOut.address}
        />
      )}
      {showOutModal && (
        <TokenModal
          tokens={TOKEN_LIST}
          balances={balances}
          selected={tokenOut}
          onSelect={setTokenOut}
          onClose={() => setShowOutModal(false)}
          excludeAddress={tokenIn.address}
        />
      )}
    </div>
  );
}
