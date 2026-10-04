export function mergeSessionMessages(current, incoming) {
  const byId = new Map();
  for (const message of [...current, ...incoming]) {
    if (message?._id) byId.set(String(message._id), message);
  }
  return [...byId.values()].sort((left, right) =>
    new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
}
