// Unit tests for apps/web/src/components/MessageInput.tsx.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MessageInput } from '../../../../apps/web/src/components/MessageInput.tsx';

beforeEach(() => {
  // no-op
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MessageInput', () => {
  it('disables the Send button while disabled prop is true', () => {
    render(<MessageInput onSend={() => undefined} disabled />);
    expect(screen.getByLabelText('Send message')).toBeDisabled();
  });

  it('disables the Send button when input is whitespace-only', () => {
    render(<MessageInput onSend={() => undefined} disabled={false} />);
    const ta = screen.getByPlaceholderText(/Ask anything/);
    fireEvent.change(ta, { target: { value: '   ' } });
    expect(screen.getByLabelText('Send message')).toBeDisabled();
  });

  it('enables the Send button once there is non-blank input', () => {
    render(<MessageInput onSend={() => undefined} disabled={false} />);
    const ta = screen.getByPlaceholderText(/Ask anything/);
    fireEvent.change(ta, { target: { value: 'real question?' } });
    expect(screen.getByLabelText('Send message')).not.toBeDisabled();
  });

  it('calls onSend with the trimmed value and clears the textarea on submit', () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} disabled={false} />);
    const ta = screen.getByPlaceholderText(/Ask anything/);

    fireEvent.change(ta, { target: { value: '  hello world  ' } });
    fireEvent.click(screen.getByLabelText('Send message'));

    expect(onSend).toHaveBeenCalledWith('hello world');
    expect((ta as HTMLTextAreaElement).value).toBe('');
  });

  it('submits on plain Enter, blocking the newline', () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} disabled={false} />);
    const ta = screen.getByPlaceholderText(/Ask anything/);
    fireEvent.change(ta, { target: { value: 'q' } });

    fireEvent.keyDown(ta, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('q');
  });

  it('inserts a newline (does NOT submit) on Shift+Enter', () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} disabled={false} />);
    const ta = screen.getByPlaceholderText(/Ask anything/);
    fireEvent.change(ta, { target: { value: 'multi' } });

    fireEvent.keyDown(ta, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('does NOT submit when disabled even on Enter', () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} disabled />);
    const ta = screen.getByPlaceholderText(/Ask anything/);
    fireEvent.change(ta, { target: { value: 'try' } });
    fireEvent.keyDown(ta, { key: 'Enter' });
    expect(onSend).not.toHaveBeenCalled();
  });
});
