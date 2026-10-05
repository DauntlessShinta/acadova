export function focusInvalidField(fields, ids) {
  const first = Object.keys(fields).find((key) => fields[key] && ids[key]);
  if (first) requestAnimationFrame(() => {
    const field = document.getElementById(ids[first]);
    field?.focus();
    field?.scrollIntoView({ block: 'nearest' });
  });
}
