// Checks that the client's login/register rules accept and reject exactly what the server's do.
//
//   cd client && npm run check:schema-parity
//
// Run it by hand after changing validation on either side. It is deliberately NOT part of CI, and adds no dependency:
// it runs through the `tsx` that the server already has installed (so `npm ci` must have been run in server/ too).
// Both sides use zod, so the same input must give the same verdict; only the error WORDING is allowed to differ.
// For every input it compares: accepted or rejected; if accepted, the cleaned-up values that would be sent; if
// rejected, WHICH fields failed.

import { readFileSync } from 'node:fs';
import { loginFormSchema, registerFormSchema } from '../src/auth/credentialSchemas';
import { loginSchema, registerSchema } from '../../server/src/auth/schemas';

type Verdict = { accepted: true; data: string } | { accepted: false; fields: string };
type Schema = { safeParse: (value: unknown) => { success: true; data: unknown } | { success: false; error: { issues: { path: PropertyKey[] }[] } } };

function judge(schema: Schema, input: unknown): Verdict {
  const result = schema.safeParse(input);
  if (result.success) return { accepted: true, data: JSON.stringify(result.data) };
  const fields = [...new Set(result.error.issues.map((issue) => String(issue.path[0] ?? '(form)')))].sort();
  return { accepted: false, fields: fields.join(',') };
}

const same = (a: Verdict, b: Verdict): boolean => JSON.stringify(a) === JSON.stringify(b);
const pad = (n: number, ch = 'a') => ch.repeat(n);
const emailOfLength = (n: number) => `${pad(n - '@example.com'.length, 'x')}@example.com`; // local part is long: invalid, on purpose

// ---------- inputs ----------
const emails: unknown[] = [
  '', ' ', 'a@b.co', ' A@B.CO ', 'USER@Example.COM', '  user@example.com\n', '\tuser@example.com', 'not-an-email', 'a@b', 'a@@b.co', '@b.co',
  'a@.co', 'a@b..co', 'a b@c.co', 'a+tag@b.co', 'a.b-c_d@sub.example.org', '"quoted"@b.co', 'a@b.c', 'a@b.company', 'ünï@exämple.com',
  'user@exämple.com', '😀@b.co', 'a@b.co ', ' a@b.co', '​a@b.co', 'a@b.co​', `${pad(64)}@b.co`, `${pad(65)}@b.co`,
  `${pad(63)}@${pad(63)}.${pad(63)}.${pad(60)}`, emailOfLength(253), emailOfLength(254), emailOfLength(255), emailOfLength(300),
  undefined, null, 5, {}, [], true,
];
const passwords: unknown[] = [
  '', ' ', '1', '1234567', '12345678', '123456789', '        ', '  spaces and more  ', 'pass\u0000word',
  pad(71), pad(72), pad(73), pad(1000), '€'.repeat(23), '€'.repeat(24), '€'.repeat(25), '😀'.repeat(18), '😀'.repeat(19),
  'é'.repeat(36), 'é'.repeat(37), `${pad(70)}é`, `${pad(71)}é`, 'é'.repeat(24), 'é'.repeat(25), '​'.repeat(8), '​'.repeat(24),
  '​'.repeat(25), 'ß'.repeat(36), 'ß'.repeat(37), '密码密码密码密码', '密'.repeat(24), '密'.repeat(25), 'Tr0ub4dor&3',
  undefined, null, 12345678, {}, [],
];
const names: unknown[] = [
  '', ' ', '   ', '\t', '\n', 'A', ' A ', 'Ann Lee', 'Åsa', 'José', pad(99, 'n'), pad(100, 'n'), pad(101, 'n'), ` ${pad(100, 'n')} `, ` ${pad(101, 'n')} `,
  '😀'.repeat(50), '😀'.repeat(51), '​', ' ', ' A ', 'a\nb', '密'.repeat(100), '密'.repeat(101),
  undefined, null, 7, {}, [],
];

// A small seeded random generator, so every run checks the same 4000 extra inputs and a failure can be reproduced.
let seed = 20261029;
const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
const pick = <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;
const alphabet = ['a', 'b', 'Z', '0', '9', '@', '.', '-', '_', '+', ' ', '\t', "'", '"', 'é', '€', '😀', '́', '​', ' ', '\n', '密'];
const randomText = (maxLength: number) => Array.from({ length: Math.floor(random() * (maxLength + 1)) }, () => pick(alphabet)).join('');
const randomEmail = () => (random() < 0.6 ? `${pick(['a', 'b.c', 'x_y', 'u+v', 'é', 'A'])}${randomText(8)}@${pick(['b.co', 'example.com', 'sub.example.org', 'ex ample.com', '-x.com', 'ünï.de'])}` : randomText(30));
const fuzz = Array.from({ length: 4000 }, () => ({ email: randomEmail(), password: randomText(random() < 0.5 ? 30 : 95), name: randomText(random() < 0.5 ? 30 : 115) }));

const registerCases = [
  ...emails.flatMap((email) => passwords.flatMap((password) => names.map((name) => ({ email, password, name })))),
  ...fuzz,
  {}, { email: 'a@b.co' }, { password: 'long-enough-1' }, { name: 'Ann' }, null, undefined, 'a string', 42,
];
const loginCases = [
  ...emails.flatMap((email) => passwords.map((password) => ({ email, password }))),
  ...fuzz.map(({ email, password }) => ({ email, password })),
  {}, { email: 'a@b.co' }, { password: 'x' }, null, undefined, 'a string', 42,
];

// ---------- compare ----------
function compare(label: string, client: Schema, server: Schema, cases: unknown[]) {
  const mismatches: { input: unknown; client: Verdict; server: Verdict }[] = [];
  let accepted = 0;
  for (const input of cases) {
    const c = judge(client, input);
    const s = judge(server, input);
    if (s.accepted) accepted += 1;
    if (!same(c, s)) mismatches.push({ input, client: c, server: s });
  }
  console.log(`${label.padEnd(9)} ${String(cases.length).padStart(6)} inputs  (${accepted} accepted by the server, ${cases.length - accepted} rejected)  ->  ${mismatches.length === 0 ? 'identical' : `${mismatches.length} MISMATCHES`}`);
  const show = (value: unknown) => {
    const text = JSON.stringify(value);
    return text.length > 150 ? `${text.slice(0, 150)}... (${text.length} chars)` : text;
  };
  for (const m of mismatches.slice(0, 8)) {
    console.log(`   input:  ${show(m.input)}\n   client: ${show(m.client)}\n   server: ${show(m.server)}`);
  }
  if (mismatches.length > 8) console.log(`   ... and ${mismatches.length - 8} more`);
  // A corpus that only ever produced one verdict would "pass" without proving anything.
  const coversBothOutcomes = accepted > 0 && accepted < cases.length;
  if (!coversBothOutcomes) console.log(`   PROBLEM: the inputs for ${label} produced only one outcome, so this check proves nothing`);
  return mismatches.length === 0 && coversBothOutcomes;
}

const version = (path: string): string => (JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as { version: string }).version;
const clientZod = version('../node_modules/zod/package.json');
const serverZod = version('../../server/node_modules/zod/package.json');
console.log(`zod: client ${clientZod}, server ${serverZod}${clientZod === serverZod ? '' : '   <-- different versions: a mismatch may come from zod itself, not from the rules'}`);

const okLogin = compare('login', loginFormSchema, loginSchema, loginCases);
const okRegister = compare('register', registerFormSchema, registerSchema, registerCases);
console.log(okLogin && okRegister ? '\nOK: the client accepts and rejects exactly what the server does.' : '\nFAILED: the client and the server disagree. Fix the rules before shipping.');
process.exit(okLogin && okRegister ? 0 : 1);
