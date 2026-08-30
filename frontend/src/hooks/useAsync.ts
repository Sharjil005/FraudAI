import { useCallback, useEffect, useRef, useState } from 'react'
import { apiErrorMessage } from '@/services/api'

interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

/**
 * Run an async loader on mount (and whenever `reload` is called),
 * tracking loading/error state and ignoring results after unmount.
 */
export function useAsync<T>(
  loader: () => Promise<T>,
  deps: unknown[] = [],
): AsyncState<T> & { reload: () => void; setData: (value: T) => void } {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: null })
  const mounted = useRef(true)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    setState((previous) => ({ ...previous, loading: true, error: null }))
    loader()
      .then((data) => {
        if (mounted.current) setState({ data, loading: false, error: null })
      })
      .catch((error: unknown) => {
        if (mounted.current) {
          setState({ data: null, loading: false, error: apiErrorMessage(error) })
        }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  const reload = useCallback(() => setNonce((value) => value + 1), [])
  const setData = useCallback((value: T) => {
    setState({ data: value, loading: false, error: null })
  }, [])

  return { ...state, reload, setData }
}
