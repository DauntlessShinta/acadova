import React from 'react';
import './PublicBrandLogo.css';

// Display the complete supplied wordmark, excluding only transparent/near-transparent
// canvas padding. The original PNG artwork and its proportions remain unchanged.
const PublicBrandLogo = () => (
  <svg className="public-brand-logo" viewBox="59 397 1362 308" width="1362" height="308" aria-hidden="true" focusable="false">
    <image href="/images/acadova-logo-new.png" width="1448" height="1086" />
  </svg>
);

export default PublicBrandLogo;
