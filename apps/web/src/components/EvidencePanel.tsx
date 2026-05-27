import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import {
  AREA_LABELS,
  PERSONA_LABELS,
  PRODUCT_LABELS,
} from '@grain/types';
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

  // `visible` is the rendered state, `slidIn` is the transform state. We
  // mount with slidIn=false, then flip it on the next animation frame so
  // the translate-x-full → translate-x-0 transition actually plays.
  const [visible, setVisible] = useState(false);
  const [slidIn, setSlidIn] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      // Defer to next frame so the initial translate-x-full has painted.
      const raf = requestAnimationFrame(() => setSlidIn(true));
      return () => cancelAnimationFrame(raf);
    }
    // Closing: start sliding out, then unmount after the transition.
    setSlidIn(false);
    const t = window.setTimeout(() => setVisible(false), 200);
    return () => window.clearTimeout(t);
  }, [isOpen]);

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

  if (!visible) return null;

  const handleOpenSource = (sourceId: string, passage: string) => {
    const qs = new URLSearchParams({ passage });
    navigate(`/source/${sourceId}?${qs.toString()}`);
  };

  return (
    <>
      <div
        aria-hidden="true"
        onClick={closePanel}
        className={`fixed inset-0 bg-fg/25 backdrop-blur-[2px] z-40 transition-opacity duration-200 ${
          slidIn ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <aside
        role="dialog"
        aria-label="Evidence panel"
        aria-modal="true"
        className={`fixed right-0 top-0 h-full w-[440px] max-w-[92vw] grain-glass-strong border-l border-border/60 grain-shadow-elevated z-50 flex flex-col motion-safe:transition-transform motion-safe:duration-300 [transition-timing-function:var(--ease-fluid)] ${
          slidIn ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-border/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <span
              className="inline-flex w-7 h-7 rounded-lg bg-accent text-accent-fg items-center justify-center text-[10px] font-bold tracking-tight grain-shadow-soft"
              aria-hidden="true"
            >
              CL
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-[10px] uppercase tracking-wider text-muted font-semibold">
                Claim
              </span>
              <span className="font-mono text-sm text-fg font-semibold">
                {openClaimId}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={closePanel}
            aria-label="Close evidence panel"
            className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-fg transition-colors focus:outline-none focus:ring-4 focus:ring-accent/15"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6 grain-scroll">
          {isLoading && (
            <div className="text-sm text-muted">Loading evidence…</div>
          )}

          {isError && (
            <div className="text-sm text-error">
              Failed to load claim. Try again.
            </div>
          )}

          {claim && (
            <>
              <section className="space-y-3.5 grain-fade-up">
                <p className="text-[15px] leading-relaxed text-fg">
                  {claim.text}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[11px] px-2.5 py-1 rounded-full bg-surface/80 border border-border text-muted font-medium">
                    {PRODUCT_LABELS[claim.product] ?? claim.product}
                  </span>
                  <span className="text-[11px] px-2.5 py-1 rounded-full bg-surface/80 border border-border text-muted font-medium">
                    {AREA_LABELS[claim.area] ?? claim.area}
                  </span>
                  <span className="text-[11px] px-2.5 py-1 rounded-full bg-surface/80 border border-border text-muted font-medium">
                    {PERSONA_LABELS[claim.persona] ?? claim.persona}
                  </span>
                </div>
              </section>

              <section className="space-y-3 grain-fade-up grain-fade-up-delay-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-fg tracking-tight">
                    Evidence
                  </h3>
                  <span className="text-[11px] uppercase tracking-wider text-muted font-semibold">
                    {claim.evidence.length} source
                    {claim.evidence.length === 1 ? '' : 's'}
                  </span>
                </div>
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
