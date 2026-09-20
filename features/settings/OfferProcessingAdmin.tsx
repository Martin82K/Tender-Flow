import { ThemedNativeSelect } from '@shared/ui/ThemedNativeSelect';
import { useEffect, useRef, useState } from 'react';
import { dbAdapter } from '@infra/db/dbAdapter';
interface Run {
    id: string;
    project_id: string | null;
    stage: string;
    model: string;
    resolved_model: string | null;
    status: string;
    reserved_usd: number;
    estimated_cost_usd: number | null;
    input_tokens: number | null;
    output_tokens: number | null;
    pages: number | null;
    created_at: string;
}
interface Report {
    settings: {
        enabled: boolean;
        monthly_limit_usd: number;
    };
    runs: Run[];
    quality: Array<{
        model: string;
        resolved_model: string | null;
        accepted: number;
        rejected: number;
    }>;
}
export function OfferProcessingAdmin({ organizationId }: {
    organizationId?: string;
}) {
    const generation = useRef(0);
    const [report, setReport] = useState<Report>();
    const [error, setError] = useState('');
    const [days, setDays] = useState(30);
    const [limit, setLimit] = useState('5');
    const [enabled, setEnabled] = useState(false);
    const [busy, setBusy] = useState(false);
    const load = async (save = false) => { if (!organizationId)
        return; const current = ++generation.current; setBusy(true); setError(''); try {
        const { data, error } = await dbAdapter.rpc('offer_processing_admin', { org_input: organizationId, days_input: days, ...(save ? { enabled_input: enabled, limit_input: Number(limit) } : {}) });
        if (error)
            throw error;
        const result = data as Report;
        if (current !== generation.current)
            return;
        setReport(result);
        setEnabled(result.settings.enabled);
        setLimit(String(result.settings.monthly_limit_usd));
    }
    catch {
        if (current === generation.current)
            setError('Statistiku nelze načíst. Vyžaduje oprávnění správce této firmy a dostupnou migraci.');
    }
    finally {
        if (current === generation.current)
            setBusy(false);
    } };
    useEffect(() => { setReport(undefined); void load(); return () => { generation.current++; }; }, [organizationId, days]);
    if (!organizationId)
        return <p>Pro přehled AI nákladů vyberte svou firmu.</p>;
    const known = report?.runs.filter(r => r.estimated_cost_usd !== null) || [];
    const unknown = report?.runs.filter(r => r.estimated_cost_usd === null) || [];
    return <section className="mb-6 space-y-4 rounded-xl border border-slate-200 p-5 dark:border-slate-700"><h2 className="text-xl font-bold">AI zpracování a náklady</h2><p className="text-sm text-slate-500">Mistral OCR a párování nabídek. Částky v USD jsou odhady podle spotřeby a uloženého sazebníku. Externí AI přes MCP je mimo náklady TF.</p>{error && <p role="alert">{error}</p>}<label>Období <ThemedNativeSelect value={days} onChange={e => setDays(Number(e.target.value))} className="rounded border bg-transparent p-2"><option value={7}>7 dní</option><option value={30}>30 dní</option><option value={90}>90 dní</option></ThemedNativeSelect></label>{report && <><div className="flex flex-wrap gap-6"><p>Známý odhad: <strong>{known.reduce((sum, r) => sum + Number(r.estimated_cost_usd), 0).toFixed(6)} USD</strong></p><p>Neznámý náklad / běžící: {unknown.length}</p><p>Neúspěšné pokusy: {report.runs.filter(r => r.status === 'failed').length}</p></div><p className="text-xs">Zobrazeno nejvýše 1 000 posledních zpracování. U neznámých nákladů zůstává pro rozpočtový limit rezervovaná částka. Dokončení API neznamená správné spárování položek.</p><div><h3 className="font-semibold">Uživatelsky ověřené návrhy</h3>{report.quality.map(q => <p key={`${q.model}:${q.resolved_model}`}>{q.resolved_model || q.model}: {q.accepted} správných, {q.rejected} chybných · {Number(q.accepted) + Number(q.rejected) ? (100 * Number(q.accepted) / (Number(q.accepted) + Number(q.rejected))).toFixed(1) : "—"} % správných z ověřených návrhů</p>)}<p className="text-xs">Neověřené návrhy se do úspěšnosti nezapočítávají.</p></div><fieldset disabled={busy} className="flex flex-wrap items-center gap-3"><legend>Nastavení firmy</legend><label><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)}/> Povolit odesílání vybraných dokumentů a položek Mistralu</label><label>Měsíční limit USD <input type="number" min="0" max="10000" step="0.01" value={limit} onChange={e => setLimit(e.target.value)} className="w-24 rounded border bg-transparent p-2"/></label><button type="button" onClick={() => void load(true)} disabled={!Number.isFinite(Number(limit)) || Number(limit) < 0} className="rounded border px-3 py-2">Uložit limit</button></fieldset><div className="overflow-auto"><table className="w-full min-w-[850px] text-sm [&_th]:p-2 [&_td]:p-2 [&_td]:whitespace-nowrap"><thead><tr><th>Čas</th><th>Projekt</th><th>Fáze</th><th>Model</th><th>Stav</th><th>Spotřeba</th><th>Odhad USD</th></tr></thead><tbody>{report.runs.map(r => <tr key={r.id} className="border-b"><td className="p-2">{new Date(r.created_at).toLocaleString('cs')}</td><td>{r.project_id || 'Odstraněný projekt'}</td><td>{r.stage}</td><td>{r.resolved_model || r.model}</td><td>{r.status}</td><td>{r.stage === 'ocr' ? `${r.pages ?? '—'} stran` : `${r.input_tokens ?? '—'} / ${r.output_tokens ?? '—'} tokenů`}</td><td>{r.estimated_cost_usd === null ? 'Neznámý' : Number(r.estimated_cost_usd).toFixed(6)}</td></tr>)}</tbody></table></div></>}</section>;
}
