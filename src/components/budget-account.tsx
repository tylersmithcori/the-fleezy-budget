import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAccount } from './account-provider';
import { budgetSchema, emptyBudget, type Budget, type Mode } from '@/lib/budget-data';
import { loadBudget, saveBudget } from '@/lib/budget-cloud';

type Bridge = { set: (state: Budget) => void; lock: (locked: boolean) => void; onSave?: (state: unknown) => void; legacy: () => unknown };
type BudgetWindow = Window & { budgetAccount?: Bridge };
export function BudgetAccount() {
  const { user, ready } = useAccount();
  const frame = useRef<HTMLIFrameElement>(null);
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [mode, setMode] = useState<Mode>('personal');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [importChoice, setImportChoice] = useState<'offer' | 'confirm' | null>(null);
  const revision = useRef(0);
  const pending = useRef<Budget | null>(null);
  const bridge = () => (frame.current?.contentWindow as BudgetWindow | null)?.budgetAccount;
  useEffect(() => {
    if (!mount || !ready) return;
    let active = true;
    bridge()?.lock(true); bridge()?.set(emptyBudget());
    pending.current = null; setImportChoice(null);
    if (!user) { setMessage(''); return; }
    setBusy(true);
    loadBudget(user.id, mode).then(result => {
      if (!active) return;
      revision.current = result.revision;
      bridge()?.set(result.budget); bridge()?.lock(false);
      const old = bridge()?.legacy();
      if (!result.hasData && mode === 'personal' && old && typeof old === 'object' && !localStorage.getItem(`tsc-import-choice:${user.id}`)) setImportChoice('offer');
      setMessage('');
    }).catch(() => { if (active) setMessage('Your account could not load. Reload to try again.'); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; bridge()?.lock(true); bridge()?.set(emptyBudget()); };
  }, [user?.id, mode, mount, ready]);
  async function persist(input: unknown) {
    if (!user) return;
    bridge()?.lock(true); setBusy(true);
    try {
      const value = budgetSchema.parse(input); pending.current = value;
      const result = await saveBudget(user.id, mode, value, revision.current);
      revision.current = result.revision; pending.current = null;
      bridge()?.set(result.budget); bridge()?.lock(false);
      setMessage('Saved to your account.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Not saved. Try again before leaving this page.');
    } finally { setBusy(false); }
  }
  useEffect(() => {
    const api = bridge(); if (!api) return;
    api.onSave = input => { void persist(input); };
    return () => { delete api.onSave; };
  }, [user?.id, mode, mount]);
  async function auth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    const form = event.currentTarget;
    const values = new FormData(form);
    const email = String(values.get('email') || '').trim();
    const password = String(values.get('password') || '');
    try {
      const result = authMode === 'forgot'
        ? await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
        : authMode === 'signup'
          ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
          : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (authMode === 'signup') setMessage('Check your email to confirm your account before logging in.');
      if (authMode === 'forgot') setMessage('Check your email for a password reset link.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to continue. Please try again.'); }
    finally { form.reset(); setBusy(false); }
  }
  function declineImport() { if (user) localStorage.setItem(`tsc-import-choice:${user.id}`, 'declined'); setImportChoice(null); }
  async function importBrowser() {
    const legacy = bridge()?.legacy();
    if (!legacy || !user || mode !== 'personal') return;
    await persist(legacy);
    if (!pending.current) { localStorage.setItem(`tsc-import-choice:${user.id}`, 'imported'); setImportChoice(null); }
  }
  const controls = <div className="account-controls">
    {!ready ? <p>Loading account…</p> : user ? <>
      <div className="account-row"><span className="account-email">{user.email}</span>
        <label className="f">Mode<select aria-label="Budget mode" value={mode} disabled={busy || !!pending.current || !!importChoice} onChange={e => setMode(e.target.value === 'business' ? 'business' : 'personal')}><option value="personal">Personal</option><option value="business">Business</option></select></label>
        <Button className="smallbtn" disabled={busy || !!pending.current} onClick={async () => { bridge()?.lock(true); bridge()?.set(emptyBudget()); const { error } = await supabase.auth.signOut(); if (error) setMessage('Logout failed. Please try again.'); }}>Logout</Button>
      </div>
      {importChoice && <div className="account-import"><p>{importChoice === 'offer' ? 'Import the data from this browser into my account' : 'Confirm import into Personal mode? Business stays empty. Nothing is imported unless you confirm.'}</p>
        <div className="account-row"><Button className="smallbtn" disabled={busy} onClick={() => importChoice === 'offer' ? setImportChoice('confirm') : void importBrowser()}>{importChoice === 'offer' ? 'Import the data from this browser into my account' : 'Confirm import'}</Button><Button className="smallbtn" disabled={busy} onClick={declineImport}>Keep my account empty</Button></div></div>}
    </> : <form className="account-form" onSubmit={auth}>
      <div className="account-row"><strong>{authMode === 'signup' ? 'Create account' : authMode === 'forgot' ? 'Reset password' : 'Login'}</strong>
        <Button type="button" className="smallbtn" onClick={() => { setAuthMode(authMode === 'signup' ? 'login' : 'signup'); setMessage(''); }}>{authMode === 'signup' ? 'Login' : 'Sign up'}</Button>
        <Button type="button" className="smallbtn" onClick={() => { setAuthMode(authMode === 'forgot' ? 'login' : 'forgot'); setMessage(''); }}>{authMode === 'forgot' ? 'Back to login' : 'Forgot password?'}</Button></div>
      <div className="account-row"><label className="f">Email<input name="email" type="email" autoComplete="email" required maxLength={255} /></label>
        {authMode !== 'forgot' && <label className="f">Password<input name="password" type="password" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} required minLength={6} maxLength={128} /></label>}
        <Button className="smallbtn" disabled={busy} type="submit">{authMode === 'signup' ? 'Create account' : authMode === 'forgot' ? 'Send reset link' : 'Login'}</Button></div>
    </form>}
    <p role="status" className="hint">{busy ? 'Please wait…' : message}</p>
    {pending.current && !busy && <Button className="smallbtn" onClick={() => void persist(pending.current)}>Retry save</Button>}
  </div>;
  return <><iframe ref={frame} src="/budget.html?account=1" title="TSC Budgeting Tool" className="fixed inset-0 h-screen w-screen border-0" onLoad={() => setMount(frame.current?.contentDocument?.getElementById('accountMount') || null)} />{mount && createPortal(controls, mount)}</>;
}

export function PasswordReset() {
  const { recovery } = useAccount();
  const [valid, setValid] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery' || recovery) setValid(true); }, [recovery]);
  return <main className="mx-auto max-w-md px-6 py-12 text-foreground"><h1 className="mb-6 text-2xl font-bold">TSC Budgeting Tool — reset password</h1>
    {valid ? <form className="grid gap-4" onSubmit={async e => {
      e.preventDefault(); setBusy(true);
      const form = e.currentTarget; const data = new FormData(form);
      const password = String(data.get('password') || '');
      if (password !== data.get('confirm')) { setMessage('Passwords do not match.'); setBusy(false); return; }
      const { error } = await supabase.auth.updateUser({ password }); form.reset();
      if (!error) { await supabase.auth.signOut(); setValid(false); setMessage('Password updated. You can now log in.'); }
      else setMessage(error.message);
      setBusy(false);
    }}><label className="grid gap-2">New password<input className="rounded-md border border-input bg-background p-3" name="password" type="password" autoComplete="new-password" minLength={6} maxLength={128} required /></label><label className="grid gap-2">Confirm password<input className="rounded-md border border-input bg-background p-3" name="confirm" type="password" autoComplete="new-password" minLength={6} maxLength={128} required /></label><Button disabled={busy}>Save new password</Button></form> : <p>{message || 'Open the password reset link from your email to continue.'}</p>}
    {valid && <p role="status" className="mt-4">{message}</p>}<Button asChild variant="link" className="mt-6"><Link to="/">Back to login</Link></Button></main>;
}