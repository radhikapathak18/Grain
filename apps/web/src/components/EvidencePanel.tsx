import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useEvidencePanelStore } from '../state/evidencePanel';
import { useClaim } from '../hooks/useClaims';
import { EvidenceItem } from './EvidenceItem';

export function EvidencePanel() {
  const openClaimId = useEvidencePanelStore((s) => s.openClaimId);
  const closePanel = useEvidencePanelStore((s) => s.closePanel);
  const navigate = useNavigate();
  const location = useLocation();
  const lastPathnameRef = useRef(location.pathname);
  const isOpen = !!openClaimId;

  const { data: claim, isLoading, isError } = useClaim(openClaimId);

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closePanel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, closePanel]);

  // Reset panel state when the user navigates to a different route (e.g.,
  // /chat → /source/:id). Without this, the panel re-renders open with the
  // previous claim when they navigate back.
  useEffect(() => {
    if (location.pathname !== lastPathnameRef.current) {
      lastPathnameRef.current = location.pathname;
      if (openClaimId) closePanel();
    }
  }, [location.pathname, openClaimId, closePanel]);

  if (!isOpen) return null;

  const handleOpenSource = (sourceId: string, passage: string) => {
    const qs = new URLSearchParams({ passage });
    navigate(`/source/${sourceId}?${qs.toString()}`);
  };

  return (
    <>
      <div
        aria-hidden="true"
        onClick={closePanel}
        className="fixed inset-0 bg-black/30 z-40"
      />

      <aside
        role="dialog"
        aria-label="Evidence panel"
        aria-modal="true"
        className="fixed right-0 top-0 h-full w-[420px] max-w-[90vw] bg-bg border-l border-border shadow-xl z-50 flex flex-col transition-transform duration-200 translate-x-0"
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-subtle">
              Claim
            </span>
            <span className="font-mono text-sm text-fg">{openClaimId}</span>
          </div>
          <button
            type="button"
            onClick={closePanel}
            aria-label="Close evidence panel"
            className="p-1 rounded-md hover:bg-surface text-muted hover:text-fg"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {isLoading && (
            <div className="text-sm text-muted">Loading evidence…</div>
          )}

          {isError && (
            <div className="text-sm text-accent">
              Failed to load claim. Try again.
            </div>
          )}

          {claim && (
            <>
              <section className="space-y-3">
                <p className="text-base leading-relaxed text-fg">
                  {claim.text}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-surface border border-border text-muted">
                    {claim.product}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-surface border border-border text-muted">
                    {claim.area}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-surface border border-border text-muted">
                    {claim.persona}
                  </span>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-fg">
                  Evidence ({claim.evidence.length})
                </h3>
                <div className="flex flex-col gap-3">
                  {claim.evidence.map((e) => (
                    <EvidenceItem
                      key={e.source_id}
                      evidence={e}
                      onOpenSource={handleOpenSource}
                    />
                  ))}
                </div>
              </section>
            </>
          )}

          {!isLoading && !isError && !claim && (
            <div className="text-sm text-muted">
              No claim found for {openClaimId}.
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
