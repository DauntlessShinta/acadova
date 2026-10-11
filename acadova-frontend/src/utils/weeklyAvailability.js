export const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const viewerTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
export function availabilityComparison(availability, selected) {
  if (!availability) return { state: 'missing', message: 'Availability not provided. Ask the tutor about a suitable time.' };
  const instant = new Date(selected);
  if (!selected || !Number.isFinite(instant.getTime())) return { state: 'unselected', message: 'Choose a time to compare with these usual hours.' };
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: availability.timezone,
      weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(instant).map((part) => [part.type, part.value]));
    const clock = `${parts.hour}:${parts.minute}`;
    const inside = availability.ranges.some((range) => range.day === weekDays.indexOf(parts.weekday) && range.start <= clock && clock < range.end);
    const equivalent = new Intl.DateTimeFormat('en', { timeZone: availability.timezone, dateStyle: 'medium', timeStyle: 'short' }).format(instant);
    return { state: inside ? 'inside' : 'outside', message: `${equivalent} (${availability.timezone}). ${inside ? 'Within usual availability; acceptance is still required.' : 'Outside usual availability. You may still request; the tutor may decline or propose another time.'}` };
  } catch { return { state: 'missing', message: 'Availability could not be interpreted. Ask the tutor about a suitable time.' }; }
}
