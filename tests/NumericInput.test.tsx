import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { NumericInput } from '@/shared/ui/NumericInput';

/**
 * NumericInput — ujišťujeme se, že:
 *  - Zobrazí formátovanou hodnotu při blur (mezery mezi tisíci, česká čárka).
 *  - Při focusu se přepne na "raw" tvar bez mezer, ale s čárkou (editovatelné).
 *  - Paste toleruje české, anglické i německé formáty a správně emituje number.
 *  - onChange dostává number | null, nikdy string.
 *  - allowNegative=false odmítne záporné hodnoty.
 */

const renderWithState = (initial: number | null = null, overrides: Record<string, unknown> = {}) => {
  const onChange = vi.fn();
  const Wrapper: React.FC = () => {
    const [value, setValue] = React.useState<number | null>(initial);
    return (
      <NumericInput
        value={value}
        onChange={(v) => {
          setValue(v);
          onChange(v);
        }}
        aria-label="numeric"
        {...overrides}
      />
    );
  };
  render(<Wrapper />);
  const input = screen.getByLabelText('numeric') as HTMLInputElement;
  return { input, onChange };
};

describe('NumericInput', () => {
  it('zobrazí formátovanou hodnotu s mezerami a čárkou (blur state)', () => {
    const { input } = renderWithState(1234567.89);
    expect(input.value).toBe('1\u00A0234\u00A0567,89');
  });

  it('přepne na raw tvar při focusu (bez mezer, s čárkou)', () => {
    const { input } = renderWithState(1234567.89);
    fireEvent.focus(input);
    expect(input.value).toBe('1234567,89');
  });

  it('paste českého formátu "1 234,56" emituje 1234.56', () => {
    const { input, onChange } = renderWithState();
    fireEvent.focus(input);
    fireEvent.paste(input, { clipboardData: { getData: () => '1 234,56' } });
    expect(onChange).toHaveBeenLastCalledWith(1234.56);
  });

  it('paste anglického formátu "1,234.56" emituje 1234.56', () => {
    const { input, onChange } = renderWithState();
    fireEvent.focus(input);
    fireEvent.paste(input, { clipboardData: { getData: () => '1,234.56' } });
    expect(onChange).toHaveBeenLastCalledWith(1234.56);
  });

  it('paste "1.234,56" emituje 1234.56 (německý/EU formát)', () => {
    const { input, onChange } = renderWithState();
    fireEvent.focus(input);
    fireEvent.paste(input, { clipboardData: { getData: () => '1.234,56' } });
    expect(onChange).toHaveBeenLastCalledWith(1234.56);
  });

  it('paste "1 234 567,89 Kč" odstraní měnu a emituje 1234567.89', () => {
    const { input, onChange } = renderWithState();
    fireEvent.focus(input);
    fireEvent.paste(input, { clipboardData: { getData: () => '1 234 567,89 Kč' } });
    expect(onChange).toHaveBeenLastCalledWith(1234567.89);
  });

  it('onChange při typing emituje number (ne string)', () => {
    const { input, onChange } = renderWithState();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '42,5' } });
    expect(onChange).toHaveBeenLastCalledWith(42.5);
  });

  it('prázdný input emituje null', () => {
    const { input, onChange } = renderWithState(100);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('při blur se znovu naformátuje pro zobrazení', () => {
    const { input } = renderWithState();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '1234567,89' } });
    fireEvent.blur(input);
    expect(input.value).toBe('1\u00A0234\u00A0567,89');
  });

  it('allowNegative=false zaokrouhlí zápornou hodnotu na 0', () => {
    const { input, onChange } = renderWithState(null, { allowNegative: false });
    fireEvent.focus(input);
    fireEvent.paste(input, { clipboardData: { getData: () => '-500' } });
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it('externí změna hodnoty aktualizuje display (když není focus)', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <NumericInput value={100} onChange={onChange} aria-label="n" />,
    );
    const input = screen.getByLabelText('n') as HTMLInputElement;
    expect(input.value).toBe('100');
    rerender(<NumericInput value={2000} onChange={onChange} aria-label="n" />);
    expect(input.value).toBe('2\u00A0000');
  });

  it('maxFractionDigits=0 ořeže desetinná místa při formátování', () => {
    const { input } = renderWithState(42.9, { maxFractionDigits: 0 });
    expect(input.value).toBe('43');
  });

  it('zobrazí suffix', () => {
    renderWithState(100, { suffix: 'Kč' });
    expect(screen.getByText('Kč')).toBeInTheDocument();
  });
});
