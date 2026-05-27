import { afterEach, describe, expect, it } from 'vitest';
import { useEvidencePanelStore } from '../../src/state/evidencePanel';

afterEach(() => {
  useEvidencePanelStore.getState().closePanel();
});

describe('useEvidencePanelStore', () => {
  it('starts with no open panel', () => {
    expect(useEvidencePanelStore.getState().openClaimId).toBeNull();
  });

  it('openPanel sets the open claim id', () => {
    useEvidencePanelStore.getState().openPanel('CL-0007');
    expect(useEvidencePanelStore.getState().openClaimId).toBe('CL-0007');
  });

  it('openPanel replaces any previously open claim', () => {
    useEvidencePanelStore.getState().openPanel('CL-0001');
    useEvidencePanelStore.getState().openPanel('CL-0002');
    expect(useEvidencePanelStore.getState().openClaimId).toBe('CL-0002');
  });

  it('closePanel clears the open claim id', () => {
    useEvidencePanelStore.getState().openPanel('CL-0009');
    useEvidencePanelStore.getState().closePanel();
    expect(useEvidencePanelStore.getState().openClaimId).toBeNull();
  });

  it('closePanel is idempotent', () => {
    useEvidencePanelStore.getState().closePanel();
    useEvidencePanelStore.getState().closePanel();
    expect(useEvidencePanelStore.getState().openClaimId).toBeNull();
  });
});
