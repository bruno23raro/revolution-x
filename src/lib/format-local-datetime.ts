/**
 * Formata um Date como `YYYY-MM-DDTHH:MM` no fuso LOCAL do usuário — o formato
 * que o <input type="datetime-local"> espera.
 *
 * O padrão ingênuo `d.toISOString().slice(0, 16)` produz o valor em UTC e o
 * controlo o interpreta como hora local: em UTC-3 (Brasil) o `min` saía ~3h à
 * frente, bloqueando agendas "hoje" (ex.: janelas de +10 min / +75 dias que
 * a UI anuncia como possíveis). O `min` enviado à API continua o mesmo.
 */
export function toLocalInputValue(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
