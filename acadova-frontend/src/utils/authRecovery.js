export function authRecoveryReason(endpoint, status, data) {
  if (endpoint.startsWith('/api/auth/')) return null;
  if (status === 403 && data?.code === 'ACCOUNT_SUSPENDED') return 'suspended';
  return status === 401 ? 'unauthorized' : null;
}
