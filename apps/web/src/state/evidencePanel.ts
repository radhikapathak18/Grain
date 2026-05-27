import { create } from 'zustand';

type EvidencePanelState = {
  openClaimId: string | null;
  openPanel: (claimId: string) => void;
  closePanel: () => void;
};

export const useEvidencePanelStore = create<EvidencePanelState>((set) => ({
  openClaimId: null,
  openPanel: (openClaimId) => set({ openClaimId }),
  closePanel: () => set({ openClaimId: null }),
}));
