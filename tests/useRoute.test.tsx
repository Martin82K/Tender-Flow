import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRoute } from '@/features/maps/hooks/useRoute';
import { mapyApiService } from '@/features/maps/services/mapyApiService';

vi.mock('@/features/maps/services/mapyApiService', () => ({
  mapyApiService: {
    route: vi.fn(),
  },
}));

const mockedRoute = vi.mocked(mapyApiService.route);

describe('useRoute', () => {
  beforeEach(() => {
    mockedRoute.mockReset();
  });

  it('does not call service when disabled', () => {
    renderHook(() => useRoute({ lat: 50, lng: 14 }, { lat: 49, lng: 15 }, false));
    expect(mockedRoute).not.toHaveBeenCalled();
  });

  it('does not call service when points missing', () => {
    renderHook(() => useRoute(null, { lat: 49, lng: 15 }));
    expect(mockedRoute).not.toHaveBeenCalled();
  });

  it('fetches route and returns distance/duration/geometry', async () => {
    mockedRoute.mockResolvedValueOnce({
      distance: 12345,
      duration: 900,
      geometry: [[14, 50], [15, 49]],
    });

    const { result } = renderHook(() =>
      useRoute({ lat: 50, lng: 14 }, { lat: 49, lng: 15 }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockedRoute).toHaveBeenCalledWith({ lat: 50, lng: 14 }, { lat: 49, lng: 15 });
    expect(result.current.route?.distance).toBe(12345);
    expect(result.current.route?.duration).toBe(900);
    expect(result.current.route?.geometry).toEqual([[14, 50], [15, 49]]);
    expect(result.current.error).toBeNull();
  });

  it('captures error when service throws', async () => {
    mockedRoute.mockRejectedValueOnce(new Error('boom'));

    const { result } = renderHook(() =>
      useRoute({ lat: 50, lng: 14 }, { lat: 49, lng: 15 }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.route).toBeNull();
  });

  it('refetches when endpoints change', async () => {
    mockedRoute.mockResolvedValue({ distance: 1, duration: 1, geometry: [] });

    const { rerender } = renderHook(
      ({ to }) => useRoute({ lat: 50, lng: 14 }, to),
      { initialProps: { to: { lat: 49, lng: 15 } } },
    );

    await waitFor(() => expect(mockedRoute).toHaveBeenCalledTimes(1));

    rerender({ to: { lat: 48, lng: 16 } });
    await waitFor(() => expect(mockedRoute).toHaveBeenCalledTimes(2));
  });
});
