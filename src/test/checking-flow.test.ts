import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { budgetSchema, toRows, fromRows } from '@/lib/budget-data';

const html = readFileSync('public/budget.html', 'utf8');
const key = 'tsc-budget-v1';
function open(saved?: string) {
  return new JSDOM(html, { url: 'http://localhost/budget.html', runScripts: 'dangerously', beforeParse(w) {
    w.scrollTo = () => {};
    if (saved) w.localStorage.setItem(key, saved);
  } });
}
function value(dom: JSDOM, id: string, value: string) {
  const input = dom.window.document.getElementById(id) as HTMLInputElement;
  input.value = value;
}
function submit(dom: JSDOM, id: string) {
  dom.window.document.getElementById(id)?.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
}
function snapshot(dom: JSDOM) { return dom.window.localStorage.getItem(key) || '{}'; }
function state(dom: JSDOM) { return JSON.parse(snapshot(dom)); }
function account(dom: JSDOM, name: string, kind: string, balance: string) {
  value(dom, 'acctName', name); value(dom, 'acctKind', kind); value(dom, 'acctBal', balance); submit(dom, 'acctForm');
  return state(dom).accounts.at(-1).id as string;
}
function bill(dom: JSDOM, id: string, biweekly = false) {
  value(dom, 'tplName', 'CareCredit'); value(dom, 'tplAmt', '30'); value(dom, 'tplOwed', '1000'); value(dom, 'tplAccount', id);
  if (biweekly) {
    const now = new Date();
    value(dom, 'tplFreq', 'biweek');
    value(dom, 'tplStart', `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2, '0')}-01`);
  }
  submit(dom, 'templateForm');
}
function toggle(dom: JSDOM, index: number, checked: boolean) {
  const box = dom.window.document.querySelectorAll<HTMLInputElement>('#billMonthList input')[index];
  if (!box) throw new Error('Missing bill occurrence');
  box.checked = checked; box.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
}

describe('Existing checking-account flow', () => {
  it('deposits a paycheck into checking, persists it, and reverses it on deletion', () => {
    const dom = open(); const id = account(dom, 'Citizens Checking', 'checking', '300');
    account(dom, 'Savings', 'savings', '90'); account(dom, 'Cash', 'cash', '10');
    expect([...dom.window.document.querySelectorAll('#rcAccount option')].map(x => x.textContent)).toEqual(['No account linked', 'Citizens Checking']);
    value(dom, 'rcName', 'Paycheck'); value(dom, 'rcAmt', '250.15'); value(dom, 'rcAccount', id); submit(dom, 'recvForm');
    expect(state(dom).accounts[0].balance).toBe(550.15);
    expect(dom.window.document.getElementById('acctBadge')?.textContent).toBe('$650.15 total');
    expect(state(dom).received[0].accountId).toBe(id);
    const reload = open(snapshot(dom));
    expect(state(reload).accounts[0].balance).toBe(550.15);
    (reload.window.document.querySelector('[data-action="del-recv"]') as HTMLElement).click();
    expect(state(reload).accounts[0].balance).toBe(300);
    dom.window.close(); reload.window.close();
  });
  it('allows income without any checking account without changing other balances', () => {
    const dom = open(); account(dom, 'Savings', 'savings', '90');
    expect(dom.window.document.getElementById('rcAccountHint')?.hidden).toBe(false);
    value(dom, 'rcName', 'Paycheck'); value(dom, 'rcAmt', '50'); submit(dom, 'recvForm');
    expect(state(dom).received[0].amount).toBe(50);
    expect(state(dom).accounts[0].balance).toBe(90); dom.window.close();
  });
  it('deducts only the $30 payment, restores it and payoff owed, and prevents double deductions', () => {
    const dom = open(); const id = account(dom, 'Checking', 'checking', '300'); bill(dom, id);
    toggle(dom, 0, true); toggle(dom, 0, true);
    expect(state(dom).accounts[0].balance).toBe(270);
    expect(dom.window.document.querySelector('#billMonthList .owed')?.textContent).toBe('$970 owed');
    const reload = open(snapshot(dom)); toggle(reload, 0, false);
    expect(state(reload).accounts[0].balance).toBe(300);
    expect(reload.window.document.querySelector('#billMonthList .owed')?.textContent).toBe('$1,000 owed');
    toggle(reload, 0, true); expect(state(reload).accounts[0].balance).toBe(270);
    dom.window.close(); reload.window.close();
  });
  it('leaves balances unchanged for unlinked bills and legacy paid history', () => {
    const dom = open(); account(dom, 'Checking', 'checking', '300'); bill(dom, '');
    toggle(dom, 0, true); toggle(dom, 0, false);
    expect(state(dom).accounts[0].balance).toBe(300);
    const old = state(dom); old.paid[Object.keys(old.paidTransactions)[0] || `${new Date().toISOString().slice(0,7)}:${old.templates[0].id}`] = true;
    old.paidTransactions = {};
    const reload = open(JSON.stringify(old)); toggle(reload, 0, false);
    expect(state(reload).accounts[0].balance).toBe(300); dom.window.close(); reload.window.close();
  });
  it('tracks and reverses each bi-weekly occurrence independently', () => {
    const dom = open(); const id = account(dom, 'Checking', 'checking', '300'); bill(dom, id, true);
    toggle(dom, 0, true); toggle(dom, 1, true);
    expect(state(dom).accounts[0].balance).toBe(240);
    toggle(dom, 0, false); expect(state(dom).accounts[0].balance).toBe(270);
    expect(Object.keys(state(dom).paid)).toHaveLength(1); dom.window.close();
  });
  it('restores the original payment to the original account after editing a paid bill', () => {
    const dom = open(); const first = account(dom, 'Citizens', 'checking', '300'); const second = account(dom, 'Chime', 'checking', '250'); bill(dom, first);
    toggle(dom, 0, true);
    (dom.window.document.querySelector('#billMonthList [data-action="edit"]') as HTMLElement).click();
    value(dom, 'eAmt', '45'); value(dom, 'eAccount', second); submit(dom, 'editForm');
    expect(state(dom).templates[0].accountId).toBe(second);
    expect(dom.window.document.querySelector('#billMonthList .owed')?.textContent).toBe('$970 owed');
    toggle(dom, 0, false); expect(state(dom).accounts.map((x: { balance: number }) => x.balance)).toEqual([300, 250]);
    toggle(dom, 0, true); expect(state(dom).accounts.map((x: { balance: number }) => x.balance)).toEqual([300, 205]); dom.window.close();
  });
  it('keeps balances in cents during repeated decimal deposits', () => {
    const dom = open(); const id = account(dom, 'Checking', 'checking', '0.10');
    for (let i = 0; i < 3; i++) { value(dom, 'rcName', 'Check'); value(dom, 'rcAmt', '0.10'); value(dom, 'rcAccount', id); submit(dom, 'recvForm'); }
    expect(state(dom).accounts[0].balance).toBe(0.4); dom.window.close();
  });
  it('round-trips account links and payment snapshots through existing cloud mapping', () => {
    const budget = budgetSchema.parse({ received: [{ id: 'check', amount: 250, accountId: 'checking' }], templates: [{ id: 'bill', amount: 30, accountId: 'checking' }], paid: { occurrence: true }, paidTransactions: { occurrence: { amount: 30, accountId: 'checking' } } });
    const restored = fromRows(toRows(budget));
    expect(restored.paidTransactions.occurrence).toEqual({ amount: 30, accountId: 'checking' });
    expect(restored.received[0]?.accountId).toBe('checking'); expect(restored.templates[0]?.accountId).toBe('checking');
  });
});