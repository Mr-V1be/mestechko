import { useCallback } from 'react';
import { useNavigate } from 'react-router';

/**
 * Back returns to where the person came from; when the screen was opened directly
 * (no history inside the app) it goes to the logical parent instead.
 */
export function useGoBack(fallback: string): () => void {
  const navigate = useNavigate();
  return useCallback(() => {
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (index > 0) {
      void navigate(-1);
    } else {
      void navigate(fallback, { replace: true });
    }
  }, [navigate, fallback]);
}
