import React from 'react';
import './PublicBrandLogo.css';

// Exact authorized raster artwork, framed from the owner's composite board.
// This is not a traced vector. Separate vector/favicon masters remain required.
const PublicBrandLogo = ({ symbol = false }) => (
  <svg className={symbol ? 'acadova-brand-symbol' : 'public-brand-logo'} viewBox={symbol ? '160 150 295 225' : '160 150 1130 225'} width={symbol ? '295' : '1130'} height="225" aria-hidden="true" focusable="false">
    <image href="/images/acadova-brand-identity.png" width="1448" height="1086" />
  </svg>
);

export default PublicBrandLogo;
