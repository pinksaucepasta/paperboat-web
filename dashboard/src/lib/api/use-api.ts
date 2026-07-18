"use client";

import * as React from "react";
import { ApiError } from "./client";

export interface ApiState<T> {
  data: T | undefined;
  error: ApiError | undefined;
  loading: boolean;
  refresh: () => void;
}

/**
 * Minimal data hook for client components calling the BFF. Runs `fn` on mount and
 * whenever `deps` change; exposes `refresh` for re-fetching after mutations.
 */
export function useApi<T>(
  fn: () => Promise<T>,
  deps: React.DependencyList = [],
): ApiState<T> {
  const [data, setData] = React.useState<T>();
  const [error, setError] = React.useState<ApiError>();
  const [loading, setLoading] = React.useState(true);
  const [nonce, setNonce] = React.useState(0);
  const refresh = React.useCallback(() => setNonce((n) => n + 1), []);
  const fnRef = React.useRef(fn);

  React.useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  React.useEffect(() => {
    let active = true;
    // Reset request state at the start of each (re)fetch. The synchronous
    // setState is intentional here — we want the loading state to flip before
    // the async request resolves.
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true);
    setError(undefined);
    /* eslint-enable react-hooks/set-state-in-effect */
    fnRef.current()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(
          err instanceof ApiError
            ? err
            : new ApiError("internal_error", "Something went wrong.", 0),
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, error, loading, refresh };
}
