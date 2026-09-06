import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { CategoryPlanNotices } from '@features/projects/ui/CategoryPlanNotices';
it('shows partial success, a scoped retry, pending state and confirmed recovery', () => {
  const onRetry = vi.fn().mockResolvedValue(undefined); const onDismiss = vi.fn();
  const props = { onRetry, onDismiss };
  const { rerender } = render(<CategoryPlanNotices {...props} notices={[{ key: 'c1', categoryTitle: 'Okna', status: 'error' }]} />);
  expect(screen.getByRole('alert')).toHaveTextContent('je uložena, ale plán VŘ');
  fireEvent.click(screen.getByRole('button', { name: 'Opakovat synchronizaci plánu VŘ' }));
  expect(onRetry).toHaveBeenCalledWith('c1');
  rerender(<CategoryPlanNotices {...props} notices={[{ key: 'c1', categoryTitle: 'Okna', status: 'syncing' }]} />);
  expect(screen.getByRole('button', { name: 'Synchronizuji…' })).toBeDisabled();
  rerender(<CategoryPlanNotices {...props} notices={[{ key: 'c1', categoryTitle: 'Okna', status: 'complete' }]} />);
  expect(screen.getByRole('status')).toHaveTextContent('i plán VŘ jsou uloženy');
  fireEvent.click(screen.getByRole('button', { name: 'Zavřít' })); expect(onDismiss).toHaveBeenCalledWith('c1');
});
