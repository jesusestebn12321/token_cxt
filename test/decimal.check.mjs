import { normalizeDecimal } from '../dist/common/database/schema-options.js';

const cases = [
  ['150.50', '150.5'], ['0.00', '0'], ['100', '100'], ['100.25', '100.25'],
  ['1E+3', '1000'], ['1.5E+2', '150'], ['1E-3', '0.001'], ['-0.50', '-0.5'],
  ['10', '10'], ['0', '0'], ['1000.000', '1000'], ['12E-1', '1.2'],
];
let bad = 0;
for (const [input, expected] of cases) {
  const got = normalizeDecimal(input);
  if (got !== expected) { bad++; console.log(`✘ ${input} → ${got} (esperado ${expected})`); }
}
console.log(bad ? `${bad} fallos` : `normalizeDecimal: ${cases.length}/${cases.length} OK`);
process.exit(bad ? 1 : 0);
