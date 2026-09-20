import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BudgetFilter } from '@features/projects/budget/ui/BudgetFilter';
import { filterItems } from '@features/projects/budget/model/budgetModel';
import { visibleBudgetRows, aggregateBudget } from '@features/projects/budget/model/budgetTree';
import type { BudgetFilters } from '@features/projects/budget/model/budgetModel';
import type { BudgetNode } from '@features/projects/budget/model/types';
import { buildAppUrl, parseAppRoute } from '@shared/routing/routeUtils';
afterEach(cleanup);
const base={sheetId:'s',parentId:null,code:'',description:'',unit:'',quantity:null,unitPrice:null,total:null,source:{sheet:'S',row:1,cells:{}},sourceType:'',tags:[],tenders:[]};
const nodes:BudgetNode[]=[{...base,id:'s',kind:'sheet',order:0},{...base,id:'a',kind:'K',order:1,parentId:'s',quantity:'2',unitPrice:'25',total:'50.00',tenders:['Zemní práce']},{...base,id:'vv',kind:'VV',order:2,parentId:'a',quantity:'2',description:'1+1'},{...base,id:'b',kind:'K',order:3,parentId:'s',total:'0.00'}];
describe('budget interaction contracts',()=>{
 it('applies typed search to real rows and preserves explicit checkbox selection after clearing search',()=>{
  function Harness(){const [filters,setFilters]=useState<BudgetFilters>({});return <><output data-testid="count">{filterItems(nodes.filter(n=>n.kind==='K'),filters).length}</output><BudgetFilter column="tenders" label="VŘ" items={nodes.filter(n=>n.kind==='K')} filters={filters} onChange={f=>setFilters({tenders:f})} onClose={()=>{}}/></>;}
  render(<Harness/>);fireEvent.change(screen.getByLabelText('Hledat VŘ'),{target:{value:'zem'}});expect(screen.getByTestId('count')).toHaveTextContent('1');
  fireEvent.click(screen.getByText('Žádné'));expect(screen.getByTestId('count')).toHaveTextContent('0');fireEvent.change(screen.getByLabelText('Hledat VŘ'),{target:{value:''}});expect(screen.getByTestId('count')).toHaveTextContent('0');fireEvent.click(screen.getByText('Vybrat vše'));expect(screen.getByTestId('count')).toHaveTextContent('2');
 });
 it('toggles VV without modifying totals or hiding the parent and respects collapsed ancestors',()=>{
  expect(visibleBudgetRows(nodes,new Set(['a','b']),new Set(),false).map(n=>n.id)).toEqual(['s','a','b']);
  expect(visibleBudgetRows(nodes,new Set(['a','b']),new Set(),true).map(n=>n.id)).toEqual(['s','a','vv','b']);
  expect(visibleBudgetRows(nodes,new Set(['a','b']),new Set(['s']),true).map(n=>n.id)).toEqual(['s']);
  expect(aggregateBudget(nodes).total).toBe('50.00');
 });
 it('round-trips the budget project route',()=>{
  const url=new URL(buildAppUrl('project',{projectId:'test',tab:'budget'}),'https://example.test');expect(parseAppRoute(url.pathname,url.search)).toMatchObject({view:'project',projectId:'test',tab:'budget'});
 });
});
it('clears visible numeric bounds without restoring a stale value on blur',()=>{
 function Harness(){const [filters,setFilters]=useState<BudgetFilters>({quantity:{min:'10',max:'20'}});return <BudgetFilter column="quantity" label="Množství" numeric items={nodes} filters={filters} onChange={f=>setFilters({quantity:f})} onClose={()=>{}}/>;}
 render(<Harness/>);expect(screen.getByLabelText('Od')).toHaveValue('10');fireEvent.click(screen.getByText('Vymazat filtr'));expect(screen.getByLabelText('Od')).toHaveValue('');expect(screen.getByLabelText('Do')).toHaveValue('');fireEvent.blur(screen.getByLabelText('Od'));expect(screen.getByLabelText('Od')).toHaveValue('');
});
it('marks incomplete totals on every affected ancestor without treating zero as missing',()=>{
 const result=aggregateBudget([...nodes,{...base,id:'missing',kind:'K',order:4,parentId:'s',total:null}]);
 expect(result.incompleteIds.has('s')).toBe(true);expect(result.incompleteIds.has('missing')).toBe(true);expect(result.incompleteIds.has('b')).toBe(false);
});
