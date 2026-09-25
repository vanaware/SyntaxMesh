/**
 * Formata duração em segundos para o formato TaskJuggler.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:DurationAttribute
 */

/**
 * Converte uma duração em segundos para uma string legível.
 *
 * Formato: `<n>h` para horas inteiras, `<n>m` para minutos, `<n>s` para
 * segundos, ou combinações como `1h30m`. Valor zero retorna `0s`.
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
  return sign + parts.join("");
}