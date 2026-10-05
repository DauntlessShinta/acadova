import { useEffect } from 'react';

// Keep browser refresh/close protection limited to actual user edits.
export function useUnsavedChanges(dirty) {
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
}
