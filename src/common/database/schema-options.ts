/**
 * Normaliza un decimal (notación plana o científica) a decimal plano sin ceros finales.
 * Lo usan los importes de Prisma.Decimal al serializar la API.
 */
export function normalizeDecimal(raw: string): string {
  let text = raw;
  const exp = /^(-?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/.exec(text);
  if (exp) {
    const [, sign, int, frac = '', e] = exp;
    const digits = int + frac;
    const point = int.length + Number(e);
    text =
      point <= 0
        ? `${sign}0.${'0'.repeat(-point)}${digits}`
        : point >= digits.length
          ? `${sign}${digits}${'0'.repeat(point - digits.length)}`
          : `${sign}${digits.slice(0, point)}.${digits.slice(point)}`;
  }
  return text.includes('.') ? text.replace(/\.?0+$/, '') : text;
}
