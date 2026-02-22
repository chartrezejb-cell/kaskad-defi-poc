import React, { useState } from "react";
import { Token, TOKEN_LIST, NATIVE_TOKEN, GALLEON_CHAIN } from "../config/contracts";
import { useLiquidity } from "../hooks/useLiquidity";
import { useBalances } from "../hooks/useBalances";
import { WalletState } from "../hooks/useWallet";

type Props = {
  wallet: WalletState;
  onConnect: () => void;
  onSwitchNetwork: () => void;
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
        <input className="search-input" placeholder="Search token..." value={search}
          onChange={(e) => setSearch(e.target.value)} autoFocus />
        <div className="token-list">
          {filtered.map((token) => (
            <button
              key={token.address}
              className={`token-row ${token.address === selected.address ? "token-row--selected" : ""}`}
              onClick={() => { onSelect(token); onClose(); }}
            >
              <div className="token-icon">{token.symbol.slice(0, 2)}</div>
              <div className="token-info">
                <span className="token-symbol">{token.symbol}</span>
                <span className="token-name">{token.name}</span>
              </div>
              <span className="token-balance">{balances[token.address] || "0"}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LiquidityWidget({ wallet, onConnect, onSwitchNetwork }: Props) {
  const liq = useLiquidity(wallet.signer, wallet.address);
  const balances = useBalances(wallet.provider, wallet.address);

  const [view, setView] = useState<"add" | "remove">("add");
  const [showModalA, setShowModalA] = useState(false);
  const [showModalB, setShowModalB] = useState(false);

  const balA = balances[liq.tokenA.address] || "0";
  const balB = balances[liq.tokenB.address] || "0";

  const hasPosition = liq.poolInfo && parseFloat(liq.poolInfo.myLpBalance) > 0;

  // Determine what action button to show
  const renderActionBtn = () => {
    if (!wallet.address) return (
      <button className="action-btn" onClick={onConnect}>Connect Wallet</button>
    );
    if (!wallet.isCorrectNetwork) return (
      <button className="action-btn action-btn--warning" onClick={onSwitchNetwork}>
        Switch to Galleon Testnet
      </button>
    );

    if (view === "add") {
      if (liq.needsApprovalA) return (
        <button className="action-btn" onClick={liq.approveA} disabled={liq.isApproving}>
          {liq.isApproving ? "Approving..." : `Approve ${liq.tokenA.symbol}`}
        </button>
      );
      if (liq.needsApprovalB) return (
        <button className="action-btn" onClick={liq.approveB} disabled={liq.isApproving}>
          {liq.isApproving ? "Approving..." : `Approve ${liq.tokenB.symbol}`}
        </button>
      );
      const canAdd = liq.amountA && liq.amountB &&
        parseFloat(liq.amountA) > 0 && parseFloat(liq.amountB) > 0 && !liq.isAdding;
      return (
        <button className="action-btn" onClick={liq.addLiquidity} disabled={!canAdd}>
          {liq.isAdding ? "Adding..." : !liq.amountA ? "Enter amounts" : "Add Liquidity"}
        </button>
      );
    }

    // Remove view
    if (liq.needsLpApproval) return (
      <button className="action-btn" onClick={liq.approveLp} disabled={liq.isApproving}>
        {liq.isApproving ? "Approving..." : "Approve LP Token"}
      </button>
    );
    const canRemove = liq.lpToRemove && parseFloat(liq.lpToRemove) > 0 && !liq.isRemoving;
    return (
      <button className="action-btn action-btn--danger" onClick={liq.removeLiquidity} disabled={!canRemove}>
        {liq.isRemoving ? "Removing..." : !liq.lpToRemove ? "Enter LP amount" : "Remove Liquidity"}
      </button>
    );
  };

  return (
    <div className="swap-widget">
      {/* Header with Add/Remove tabs */}
      <div className="swap-header">
        <div className="liq-tabs">
          <button
            className={`liq-tab ${view === "add" ? "liq-tab--active" : ""}`}
            onClick={() => setView("add")}
          >
            Add
          </button>
          <button
            className={`liq-tab ${view === "remove" ? "liq-tab--active" : ""}`}
            onClick={() => setView("remove")}
          >
            Remove
          </button>
        </div>
        <span className="slippage-badge">0.5% slippage</span>
      </div>

      {/* Pool Stats */}
      {liq.isLoadingPool && (
        <div className="pool-loading">Loading pool data<span className="loading-dots">···</span></div>
      )}

      {liq.poolInfo && !liq.isLoadingPool && (
        <div className="pool-stats">
          <div className="pool-stats-title">Pool Info</div>
          <div className="detail-row">
            <span className="detail-label">{liq.tokenA.symbol} reserves</span>
            <span className="detail-value">{parseFloat(liq.poolInfo.reserve0).toLocaleString()}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">{liq.tokenB.symbol} reserves</span>
            <span className="detail-value">{parseFloat(liq.poolInfo.reserve1).toLocaleString()}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Total LP supply</span>
            <span className="detail-value">{parseFloat(liq.poolInfo.totalSupply).toFixed(4)}</span>
          </div>
          {hasPosition && (
            <>
              <div className="pool-stats-divider" />
              <div className="pool-stats-title">My Position</div>
              <div className="detail-row">
                <span className="detail-label">My LP tokens</span>
                <span className="detail-value">{parseFloat(liq.poolInfo.myLpBalance).toFixed(6)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">My share</span>
                <span className="detail-value">{liq.poolInfo.myShare}%</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">My {liq.tokenA.symbol}</span>
                <span className="detail-value">{liq.poolInfo.myToken0}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">My {liq.tokenB.symbol}</span>
                <span className="detail-value">{liq.poolInfo.myToken1}</span>
              </div>
            </>
          )}
        </div>
      )}

      {!liq.poolInfo && !liq.isLoadingPool && liq.tokenA && liq.tokenB && (
        <div className="pool-new-notice">
          No pool exists yet for this pair. You will create it and set the initial price.
        </div>
      )}

      {/* ADD LIQUIDITY VIEW */}
      {view === "add" && (
        <>
          {/* Token A */}
          <div className="token-box">
            <div className="token-box-top">
              <button className="token-selector" onClick={() => setShowModalA(true)}>
                <div className="token-selector-icon">{liq.tokenA.symbol.slice(0, 2)}</div>
                <span>{liq.tokenA.symbol}</span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
              <input
                className="amount-input"
                type="number"
                placeholder="0.0"
                value={liq.amountA}
                onChange={(e) => liq.setAmountA(e.target.value)}
                min="0"
              />
            </div>
            <div className="token-box-bottom">
              <span className="balance-label">Balance: <span className="balance-value">{balA}</span></span>
              {wallet.address && (
                <button className="max-btn" onClick={() => liq.setAmountA(balA)}>MAX</button>
              )}
            </div>
          </div>

          <div className="plus-row">
            <div className="plus-icon">+</div>
          </div>

          {/* Token B */}
          <div className="token-box token-box--out">
            <div className="token-box-top">
              <button className="token-selector" onClick={() => setShowModalB(true)}>
                <div className="token-selector-icon">{liq.tokenB.symbol.slice(0, 2)}</div>
                <span>{liq.tokenB.symbol}</span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
              <input
                className="amount-input"
                type="number"
                placeholder="0.0"
                value={liq.amountB}
                onChange={(e) => liq.setAmountB(e.target.value)}
                min="0"
              />
            </div>
            <div className="token-box-bottom">
              <span className="balance-label">Balance: <span className="balance-value">{balB}</span></span>
              {wallet.address && (
                <button className="max-btn" onClick={() => liq.setAmountB(balB)}>MAX</button>
              )}
            </div>
          </div>

          {/* Share preview */}
          {liq.amountA && liq.amountB && parseFloat(liq.amountA) > 0 && (
            <div className="swap-details">
              <div className="detail-row">
                <span className="detail-label">Rate</span>
                <span className="detail-value">
                  1 {liq.tokenA.symbol} = {(parseFloat(liq.amountB) / parseFloat(liq.amountA)).toFixed(6)} {liq.tokenB.symbol}
                </span>
              </div>
              {liq.poolInfo && (
                <div className="detail-row">
                  <span className="detail-label">Est. pool share</span>
                  <span className="detail-value">
                    {(
                      (parseFloat(liq.amountA) /
                        (parseFloat(liq.poolInfo.reserve0) + parseFloat(liq.amountA))) * 100
                    ).toFixed(4)}%
                  </span>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* REMOVE LIQUIDITY VIEW */}
      {view === "remove" && (
        <>
          {!hasPosition && (
            <div className="pool-new-notice">
              You have no LP position for this pair.
            </div>
          )}

          {hasPosition && liq.poolInfo && (
            <>
              <div className="token-box">
                <div className="token-box-top">
                  <span className="lp-label">LP Tokens to remove</span>
                  <input
                    className="amount-input"
                    type="number"
                    placeholder="0.0"
                    value={liq.lpToRemove}
                    onChange={(e) => liq.setLpToRemove(e.target.value)}
                    min="0"
                    max={liq.poolInfo.myLpBalance}
                  />
                </div>
                <div className="token-box-bottom">
                  <span className="balance-label">
                    Balance: <span className="balance-value">{parseFloat(liq.poolInfo.myLpBalance).toFixed(6)}</span>
                  </span>
                  <button className="max-btn" onClick={() => liq.setLpToRemove(liq.poolInfo!.myLpBalance)}>MAX</button>
                </div>
              </div>

              {/* Percentage quick-select */}
              <div className="pct-row">
                {[25, 50, 75, 100].map(pct => (
                  <button
                    key={pct}
                    className="pct-btn"
                    onClick={() =>
                      liq.setLpToRemove(
                        ((parseFloat(liq.poolInfo!.myLpBalance) * pct) / 100).toFixed(18)
                      )
                    }
                  >
                    {pct}%
                  </button>
                ))}
              </div>

              {liq.lpToRemove && parseFloat(liq.lpToRemove) > 0 && (
                <div className="swap-details">
                  <div className="detail-row">
                    <span className="detail-label">You receive {liq.tokenA.symbol}</span>
                    <span className="detail-value">{liq.removeAmountA}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">You receive {liq.tokenB.symbol}</span>
                    <span className="detail-value">{liq.removeAmountB}</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Token pair selector when no position */}
          <div className="liq-pair-selector">
            <span className="detail-label">Pair</span>
            <div className="pair-selectors">
              <button className="token-selector token-selector--sm" onClick={() => setShowModalA(true)}>
                <div className="token-selector-icon token-selector-icon--sm">{liq.tokenA.symbol.slice(0, 2)}</div>
                <span>{liq.tokenA.symbol}</span>
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
              <span className="pair-slash">/</span>
              <button className="token-selector token-selector--sm" onClick={() => setShowModalB(true)}>
                <div className="token-selector-icon token-selector-icon--sm">{liq.tokenB.symbol.slice(0, 2)}</div>
                <span>{liq.tokenB.symbol}</span>
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Error */}
      {liq.error && (
        <div className="error-box">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="#f97066" strokeWidth="1.2"/>
            <path d="M7 4v3.5M7 9.5v.5" stroke="#f97066" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          {liq.error}
        </div>
      )}

      {/* Success */}
      {liq.txHash && (
        <div className="success-box">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="#4ade80" strokeWidth="1.2"/>
            <path d="M4.5 7L6.5 9L9.5 5" stroke="#4ade80" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {view === "add" ? "Liquidity added!" : "Liquidity removed!"}{" "}
          <a href={`${GALLEON_CHAIN.explorerUrl}/tx/${liq.txHash}`}
            target="_blank" rel="noopener noreferrer" className="tx-link">
            View on explorer ↗
          </a>
        </div>
      )}

      {renderActionBtn()}

      {/* Modals */}
      {showModalA && (
        <TokenModal tokens={TOKEN_LIST} balances={balances} selected={liq.tokenA}
          onSelect={liq.setTokenA} onClose={() => setShowModalA(false)}
          excludeAddress={liq.tokenB.address} />
      )}
      {showModalB && (
        <TokenModal tokens={TOKEN_LIST} balances={balances} selected={liq.tokenB}
          onSelect={liq.setTokenB} onClose={() => setShowModalB(false)}
          excludeAddress={liq.tokenA.address} />
      )}
    </div>
  );
}
