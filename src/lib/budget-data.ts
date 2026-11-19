import { z } from 'zod';

export type Mode = 'personal' | 'business';
const entry = z.object({ id: z.string().min(1).max(200), name: z.string().max(500).optional(), amount: z.number().finite().nonnegative().optional(), balance: z.number().finite().optional(), dueDay: z.number().int().min(1).max(31).optional(), owed: z.number().finite().nonnegative().optional(), receipt: z.string().optional(), receiptPath: z.string().optional(), checkin: z.string().optional(), position: z.number().optional() }).passthrough();
export const budgetSchema = z.object({
  incomes: z.array(entry).default([]), templates: z.array(entry).default([]),
  expenses: z.array(entry).default([]), accounts: z.array(entry).default([]),
  received: z.array(entry).default([]), ebtExp: z.array(entry).default([]),
  paid: z.record(z.boolean()).default({}), ebtAmt: z.record(z.number().finite().nonnegative()).default({}),
  paidTransactions: z.record(z.object({ amount: z.number().finite().nonnegative(), accountId: z.string() })).default({}),
  saveMode: z.enum(['pct', 'amt']).default('pct'), saveVal: z.number().finite().nonnegative().default(0),
  showWeekly: z.boolean().default(false), notifyOn: z.boolean().default(false),
  notified: z.record(z.boolean()).default({}),
});
export type Budget = z.infer<typeof budgetSchema>;
export const emptyBudget = (): Budget => budgetSchema.parse({});
export const tables = ['bills', 'payoff_bills', 'income', 'spending', 'savings', 'accounts', 'ebt_entries', 'receipts', 'weekly_checkins', 'bill_payments'] as const;
export type Table = typeof tables[number];
export type Row = { id: string; data: Record<string, unknown> };
export type Rows = Record<Table, Row[]>;
export function toRows(state: Budget): Rows {
  const rows = Object.fromEntries(tables.map(t => [t, []])) as unknown as Rows;
  const add = (table: Table, id: string, data: Record<string, unknown>) => rows[table].push({ id, data });
  state.templates.forEach((x, position) => add(Number(x.owed) > 0 ? 'payoff_bills' : 'bills', x.id, { ...x, position }));
  state.incomes.forEach((x, position) => add('income', x.id, { ...x, position }));
  state.expenses.forEach(x => {
    const { receipt: _receipt, receiptPath, ...data } = x;
    add('spending', x.id, data);
    if (typeof receiptPath === 'string') add('receipts', x.id, { path: receiptPath });
  });
  state.accounts.forEach(x => add('accounts', x.id, x));
  state.received.forEach(x => add(x.checkin ? 'weekly_checkins' : 'income', x.id, { ...x, received: true }));
  state.ebtExp.forEach(x => add('ebt_entries', x.id, { ...x, kind: 'purchase' }));
  Object.entries(state.ebtAmt).forEach(([month, amount]) => add('ebt_entries', `benefit:${month}`, { kind: 'benefit', month, amount }));
  Object.entries(state.paid).filter(([, paid]) => paid).forEach(([id]) => add('bill_payments', id, { paid: true, transaction: state.paidTransactions[id] }));
  add('savings', 'settings', { saveMode: state.saveMode, saveVal: state.saveVal, showWeekly: state.showWeekly, notifyOn: state.notifyOn, notified: state.notified });
  return rows;
}
export function fromRows(rows: Rows): Budget {
  const ordered = (r: Row[]) => r.slice().sort((a, b) => Number(a.data['position'] || 0) - Number(b.data['position'] || 0)).map(x => ({ ...x.data, id: x.id }));
  const settings = rows.savings.find(x => x.id === 'settings')?.data || {};
  return budgetSchema.parse({ ...settings,
    templates: ordered([...rows.bills, ...rows.payoff_bills]),
    incomes: ordered(rows.income.filter(x => !x.data['received'])),
    received: ordered([...rows.income.filter(x => x.data['received']), ...rows.weekly_checkins]),
    expenses: ordered(rows.spending).map(x => ({ ...x, receiptPath: rows.receipts.find(r => r.id === x.id)?.data['path'] })),
    accounts: ordered(rows.accounts), ebtExp: ordered(rows.ebt_entries.filter(x => x.data['kind'] === 'purchase')),
    ebtAmt: Object.fromEntries(rows.ebt_entries.filter(x => x.data['kind'] === 'benefit').map(x => [x.data['month'], x.data['amount']])),
    paid: Object.fromEntries(rows.bill_payments.map(x => [x.id, true])),
    paidTransactions: Object.fromEntries(rows.bill_payments.filter(x => x.data['transaction']).map(x => [x.id, x.data['transaction']])),
  });
}