/**
 * Formats a duration in seconds into the TaskJuggler format.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:DurationAttribute
 */

/**
 * Converts a duration in seconds into a readable string.
 *
 * Format: `<n>h` for whole hours, `<n>m` for minutes, `<n>s` for seconds, or
 * combinations such as `1h30m`. A zero value returns `0s`.
 */
export function formatDuration(seconds: number,): string {
  if (!Number.isFinite(seconds,)) {
    return "0s";
  }
  const total = Math.round(seconds,);
  if (total === 0) {
    return "0s";
  }
  const sign = total < 0 ? "-" : "";
  const abs = Math.abs(total,);
  const hours = Math.floor(abs / 3600,);
  const minutes = Math.floor((abs % 3600) / 60,);
  const secs = abs % 60;
  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours}h`,);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`,);
  }
  if (secs > 0 || parts.length === 0) {
    parts.push(`${secs}s`,);
  }
  return sign + parts.join("",);
}
