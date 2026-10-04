export const hasReachedPolicyEnd = ({ scrollTop, clientHeight, scrollHeight }) =>
  scrollTop + clientHeight >= scrollHeight - 8;

export const canCompletePolicyReview = (reachedEnd, checked) =>
  reachedEnd === true && checked === true;
