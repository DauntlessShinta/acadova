export const toastTypes = ['success', 'error', 'warning', 'info'];

export function makeToast(type, message, id) {
  return {
    id,
    type: toastTypes.includes(type) ? type : 'info',
    message: typeof message === 'string' && message.trim()
      ? message.trim().slice(0, 300) : 'Please try again.',
  };
}

export function addToast(current, toast) {
  return [...current, toast].slice(-3);
}

export function dismissToast(current, id) {
  return current.filter((toast) => toast.id !== id);
}
