import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Layers } from 'lucide-react';
import type { ProductId } from '@grain/types';
import { useSessionStore } from '../state/session';

export function ProductSelectView() {
  const navigate = useNavigate();
  const user = useSessionStore((s) => s.user);
  const availableProducts = useSessionStore((s) => s.availableProducts);
  const selectedProducts = useSessionStore((s) => s.selectedProducts);
  const setSelectedProducts = useSessionStore((s) => s.setSelectedProducts);
  const confirmProducts = useSessionStore((s) => s.confirmProducts);

  if (!user) return null;

  function toggle(id: ProductId) {
    if (selectedProducts.includes(id)) {
      setSelectedProducts(selectedProducts.filter((p) => p !== id));
    } else {
      setSelectedProducts([...selectedProducts, id]);
    }
  }

  function onContinue() {
    if (selectedProducts.length === 0) return;
    confirmProducts();
    navigate('/chat');
  }

  return (
    <div className="grain-aurora min-h-screen flex items-center justify-center p-6 bg-bg">
      <div className="w-full max-w-xl grain-fade-up grain-glass-strong rounded-2xl p-8 sm:p-10 grain-shadow-elevated">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-accent text-accent-fg flex items-center justify-center grain-shadow-soft">
            <Layers size={20} strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="grain-headline text-2xl font-semibold text-fg">
              Pick your products
            </h1>
            <p className="text-muted text-sm">
              Grain scopes every answer to the products you select.
            </p>
          </div>
        </div>

        <div role="group" aria-label="Products" className="space-y-2.5 mb-7">
          {availableProducts.map((p, i) => {
            const isSelected = selectedProducts.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                role="checkbox"
                aria-checked={isSelected}
                onClick={() => toggle(p.id)}
                style={{ animationDelay: `${80 + i * 60}ms` }}
                className={`grain-fade-up w-full flex items-center justify-between px-4 py-3.5 rounded-xl border text-left transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-accent/15 ${
                  isSelected
                    ? 'border-accent bg-accent-subtle/60 grain-shadow-soft'
                    : 'border-border bg-bg hover:border-border-strong hover:bg-surface/60'
                }`}
              >
                <div className="flex flex-col">
                  <span className="text-fg font-medium leading-snug">
                    {p.displayName}
                  </span>
                  <span className="text-xs text-muted mt-0.5">
                    {isSelected ? 'Included in this session' : 'Tap to include'}
                  </span>
                </div>
                <span
                  className={`w-6 h-6 rounded-md border flex items-center justify-center transition-all duration-200 ${
                    isSelected
                      ? 'border-transparent bg-accent text-accent-fg'
                      : 'border-border-strong'
                  }`}
                  aria-hidden
                >
                  {isSelected && <Check size={14} strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onContinue}
          disabled={selectedProducts.length === 0}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-accent hover:bg-accent-hover text-accent-fg rounded-lg font-medium grain-shadow-soft disabled:opacity-50 disabled:cursor-not-allowed transition-[background-color,transform] duration-150 active:scale-[0.99]"
        >
          Continue
          <span className="text-accent-fg/80 text-sm font-normal">
            · {selectedProducts.length} selected
          </span>
          <ArrowRight size={16} className="ml-0.5" />
        </button>
      </div>
    </div>
  );
}
