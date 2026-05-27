// Unit tests for apps/web/src/components/QuestionShapeSelector.tsx.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { QuestionShapeSelector } from '../../../../apps/web/src/components/QuestionShapeSelector.tsx';
import { useSessionStore } from '../../../../apps/web/src/state/session.ts';

beforeEach(() => {
  useSessionStore.getState().reset();
});

afterEach(() => {
  useSessionStore.getState().reset();
});

describe('QuestionShapeSelector', () => {
  it('renders three shape tabs', () => {
    render(<QuestionShapeSelector />);
    const tablist = screen.getByRole('tablist', { name: 'Question shape' });
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs).toHaveLength(3);
  });

  it('marks the active shape with aria-selected', () => {
    render(<QuestionShapeSelector />);
    const exploreTab = screen.getByRole('tab', { name: /Explore/ });
    expect(exploreTab).toHaveAttribute('aria-selected', 'true');
  });

  it('updates the store when a different tab is clicked', () => {
    render(<QuestionShapeSelector />);
    fireEvent.click(screen.getByRole('tab', { name: /Verify/ }));
    expect(useSessionStore.getState().questionShape).toBe('verify');
  });

  it('reflects external store changes', () => {
    render(<QuestionShapeSelector />);
    act(() => {
      useSessionStore.getState().setShape('trends');
    });
    expect(
      screen.getByRole('tab', { name: /See trends/ }),
    ).toHaveAttribute('aria-selected', 'true');
  });
});
