import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
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
    <div className="min-h-screen flex items-center justify-center p-8 bg-surface">
      <div className="w-full max-w-lg bg-bg border border-border rounded-lg p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-fg mb-2">
          Which products are you working across?
        </h1>
        <p className="text-muted text-sm mb-6">
          Grain will scope every answer to research from the products you pick.
          You can change this any time from the header.
        </p>

        <div role="group" aria-label="Products" className="space-y-2 mb-6">
          {availableProducts.map((p) => {
            const isSelected = selectedProducts.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                role="checkbox"
                aria-checked={isSelected}
                onClick={() => toggle(p.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-md border transition-colors text-left focus:outline-none focus:ring-2 focus:ring-accent/40 ${
                  isSelected
                    ? 'border-accent bg-accent-subtle'
                    : 'border-border bg-bg hover:border-border-strong'
                }`}
              >
                <span className="text-fg font-medium">{p.displayName}</span>
                <span
                  className={`w-5 h-5 rounded border flex items-center justify-center ${
                    isSelected
                      ? 'border-accent bg-accent text-accent-fg'
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
          className="w-full py-2 bg-accent text-accent-fg rounded-md font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
        >
          Continue ({selectedProducts.length} selected)
        </button>
      </div>
    </div>
  );
}
