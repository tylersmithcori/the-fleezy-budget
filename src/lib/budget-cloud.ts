import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { fromRows, toRows, tables, type Budget, type Mode, type Rows } from './budget-data';

export async function loadBudget(userId: string, mode: Mode) {
  const rows = Object.fromEntries(await Promise.all(tables.map(async table => {
    const all = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.from(table).select('id,data').eq('user_id', userId).eq('mode', mode).order('id').range(offset, offset + 999);
      if (error) throw error;
      all.push(...data);
      if (data.length < 1000) break;
    }
    return [table, all];
  }))) as Rows;
  const budget = fromRows(rows);
  await signReceipts(budget);
  return { budget, revision: Number(rows.savings.find(x => x.id === 'settings')?.data['revision'] || 0), hasData: tables.some(t => rows[t].length > 0) };
}
async function signReceipts(budget: Budget) {
  await Promise.all(budget.expenses.map(async x => {
    if (typeof x.receiptPath !== 'string') return;
    const { data, error } = await supabase.storage.from('receipts').createSignedUrl(x.receiptPath, 3600);
    if (error) throw error;
    x.receipt = data.signedUrl;
  }));
}
export async function saveBudget(userId: string, mode: Mode, input: Budget, revision: number) {
  const budget = structuredClone(input);
  for (const x of budget.expenses) {
    if (typeof x.receipt !== 'string' || !x.receipt.startsWith('data:image/')) continue;
    const blob = await fetch(x.receipt).then(r => r.blob());
    if (!blob.type.startsWith('image/') || blob.size > 5 * 1024 * 1024) throw new Error('Receipt must be an image under 5 MB.');
    const path = `${userId}/${mode}/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage.from('receipts').upload(path, blob, { contentType: blob.type });
    if (error) throw error;
    x.receiptPath = path;
  }
  const { data, error } = await supabase.rpc('save_budget', { p_mode: mode, p_rows: toRows(budget) as unknown as Json, p_revision: revision });
  if (error) throw error;
  await signReceipts(budget);
  return { budget, revision: data };
}