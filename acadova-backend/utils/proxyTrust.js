const { isIP } = require('node:net');

// Only operator-verified proxy addresses/subnets, never boolean or hop-count trust.
function configureProxyTrust(app, value = process.env.TRUST_PROXY_CIDRS) {
  if (!value?.trim()) { app.set('trust proxy', false); return; }
  const addresses = value.split(',').map((entry) => entry.trim());
  for (const address of addresses) {
    const parts = address.split('/');
    const family = isIP(parts[0]);
    if (!family || parts.length > 2 || (parts.length === 2
      && (!/^\d+$/.test(parts[1]) || Number(parts[1]) < 1
        || Number(parts[1]) > (family === 4 ? 32 : 128)))) {
      throw new Error('TRUST_PROXY_CIDRS must contain explicit proxy IP addresses or non-global CIDRs.');
    }
  }
  app.set('trust proxy', addresses);
}
module.exports = { configureProxyTrust };
