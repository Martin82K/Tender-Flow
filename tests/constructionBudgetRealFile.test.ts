// Local-only input; the customer's workbook is never committed as a fixture.
// @vitest-environment node
import { readFileSync } from 'node:fs';
import { it, expect } from 'vitest';
import { readKrosFile } from '@features/projects/budget/model/krosImport';
import { aggregateBudget } from '@features/projects/budget/model/budgetTree';
it.skipIf(!process.env.BUDGET_SMOKE_FILE)('converts the supplied KROS workbook without counting helper rows twice', () => {
  const start=performance.now(); const d=readKrosFile(readFileSync(process.env.BUDGET_SMOKE_FILE!));
  expect(d.sheets).toHaveLength(70); expect(d.sheets.filter(s=>s.role==='items')).toHaveLength(67);
  expect(d.nodes.filter(n=>n.kind==='K'||n.kind==='M')).toHaveLength(4150);
  expect(d.nodes.filter(n=>n.kind==='section')).toHaveLength(352);
  expect(d.nodes.filter(n=>n.kind==='VV')).toHaveLength(4115);
  const item=d.nodes.find(n=>n.code==='213221111.ZC'&&n.source.row===119)!;
  expect(item.quantity).toBe('135.228'); expect(item.total).toBe('943891.44');
  expect(d.nodes.find(n=>n.parentId===item.id&&n.kind==='VV')?.description).toBe('ZKD01_01*0,1');
  console.log(JSON.stringify({milliseconds:performance.now()-start,total:aggregateBudget(d.nodes).total,issues:d.issues.length,errors:d.issues.filter(i=>i.severity==='error').length,roles:d.sheets.reduce((a,s)=>({...a,[s.role]:(a[s.role]||0)+1}),{} as Record<string,number>)}));
},30000);
