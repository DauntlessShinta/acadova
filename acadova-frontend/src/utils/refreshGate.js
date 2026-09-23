// Serialize background reads and discard responses started before a mutation
// or unmount. This prevents a slow poll from restoring an old session status.
export const createRefreshGate = () => {
  let version = 0;
  let busy = false;
  return {
    start() {
      if (busy) return null;
      busy = true;
      return ++version;
    },
    isCurrent(ticket) { return ticket === version; },
    finish(ticket) { if (ticket === version) busy = false; },
    invalidate() { version += 1; busy = false; },
  };
};
