import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { CategoryFormModal } from '@features/projects/pipeline/ui/CategoryFormModal';

it('ignores repeated form submit events until the original save finishes', async () => {
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  const onSubmit = vi.fn().mockReturnValueOnce(pending).mockResolvedValue(undefined);
  render(<CategoryFormModal isOpen mode="create" onClose={vi.fn()} onSubmit={onSubmit} />);
  const form = screen.getByRole('button', { name: 'Vytvořit poptávku' }).closest('form')!;
  act(() => { fireEvent.submit(form); fireEvent.submit(form); });
  expect(onSubmit).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: /Ukládání/ })).toBeDisabled();
  await act(async () => { finish(); await pending; });
  await act(async () => { fireEvent.submit(form); });
  expect(onSubmit).toHaveBeenCalledTimes(2);
});
