import { describe, expect, it } from 'vitest';
import { emptyBudget, toRows, fromRows } from '@/lib/budget-data';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

describe('Private account budgeting', () => {
  it('new account budgets contain no money entries or savings amount', () => {
    const state = emptyBudget();
    expect(state.incomes).toEqual([]); expect(state.templates).toEqual([]);
    expect(state.expenses).toEqual([]); expect(state.accounts).toEqual([]);
    expect(state.ebtExp).toEqual([]); expect(state.ebtAmt).toEqual({});
    expect(state.received).toEqual([]); expect(state.saveVal).toBe(0);
  });
  it('personal and business lists never combine', () => {
    const personal = emptyBudget(); personal.incomes.push({ id: 'p', name: 'Paycheck', amount: 500 });
    const business = emptyBudget(); business.incomes.push({ id: 'b', name: 'Client', amount: 120 });
    expect(fromRows(toRows(personal)).incomes.map(x => x.amount)).toEqual([500]);
    expect(fromRows(toRows(business)).incomes.map(x => x.amount)).toEqual([120]);
  });
  it('EBT entries remain apart from cash and income', () => {
    const state = emptyBudget(); state.ebtAmt = { '2026-11': 240 };
    const result = fromRows(toRows(state));
    expect(result.ebtAmt['2026-11']).toBe(240); expect(result.incomes).toEqual([]); expect(result.accounts).toEqual([]);
  });
  it('receipt records contain private paths, never image payloads or signed URLs', () => {
    const state = emptyBudget(); state.expenses.push({ id: 'x', name: 'Gas', amount: 40, receipt: 'https://private.example/signed', receiptPath: 'user/personal/photo.jpg' });
    const rows = toRows(state);
    expect(rows.receipts[0]?.data['path']).toBe('user/personal/photo.jpg');
    expect(rows.spending[0]?.data).not.toHaveProperty('receipt');
  });
  it('weekly check-ins are saved apart from planned income without losing their received amount', () => {
    const state = emptyBudget(); state.received.push({ id: 'ci', name: 'Weekly check-in', amount: 500, checkin: '2026-11-08' });
    const rows = toRows(state);
    expect(rows.income).toEqual([]); expect(rows.weekly_checkins).toHaveLength(1);
    expect(fromRows(rows).received[0]?.amount).toBe(500);
  });
  it('account mode never automatically reads browser budget data', () => {
    const dom = new JSDOM(readFileSync('public/budget.html', 'utf8'), { url: 'http://localhost/budget.html?account=1', runScripts: 'dangerously', beforeParse(w) {
      w.scrollTo = () => {};
      w.localStorage.setItem('tsc-budget-v1', JSON.stringify({ incomes: [{ id: 'old', name: 'Old', amount: 2000 }] }));
    } });
    expect(dom.window.document.getElementById('statIncome')?.textContent).toBe('$0');
    expect(dom.window.document.getElementById('incomeList')?.children.length).toBe(0);
    dom.window.close();
  });
});