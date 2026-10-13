// Format timestamps in displayed copy only; persisted notification history is unchanged.
export function notificationMessage(message = '') {
  return message.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z(?: \(UTC\))?/g, value => {
    const date = new Date(value.replace(' (UTC)', ''));
    return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 19) !== value.slice(0, 19)
      ? value : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  });
}
