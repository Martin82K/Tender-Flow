import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BudgetVersions } from '@features/projects/budget/ui/BudgetVersions';
import type { BudgetRevisionSummary } from '@features/projects/budget/api/budgetApi';
import type { BudgetSource } from '@features/projects/budget/model/types';

afterEach(cleanup);
const revision: BudgetRevisionSummary = { id:'r', title:'Rozpočet 1', status:'confirmed', version:3, source_id:'s', created_at:'2026-09-19T10:00:00Z', allocation_count:1, category_ids:['t'] };
const source: BudgetSource = { id:'s', project_id:'p', filename:'rozpocet.xlsx', storage_path:'s', sha256:'a', status:'ready', created_at:revision.created_at };
const props = { revisions:[revision], sources:[source], permissions:{read:true, prices:true, edit:true, confirm:true, allocate:true}, readOnly:false, categoryNames:new Map([['t','Zemní práce']]), onOpen:vi.fn(), onDownload:vi.fn(), onConvert:vi.fn(), onChange:vi.fn().mockResolvedValue(undefined) };
describe('budget trash', () => {
 it('previews tender impact and requires confirmation before removing a revision', async () => {
  const onChange=vi.fn().mockResolvedValue(undefined);
  render(<BudgetVersions {...props} onChange={onChange}/>);
  fireEvent.click(screen.getByRole('button',{name:'Odstranit revizi Rozpočet 1'}));
  expect(screen.getByText('Zemní práce')).toBeVisible();
  expect(screen.getByText(/Částky v plánu VŘ/)).toBeVisible();
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Přesunout do koše'}));
  await waitFor(()=>expect(onChange).toHaveBeenCalledWith('r','revision',false,3));
 });
 it('blocks removing a source used by an active revision', () => {
  render(<BudgetVersions {...props}/>);
  fireEvent.click(screen.getByRole('button',{name:'Odstranit přílohu rozpocet.xlsx'}));
  expect(screen.getByRole('alert')).toHaveTextContent('1 aktivních revizí');
  expect(screen.getByRole('button',{name:'Přesunout do koše'})).toBeDisabled();
 });
 it('restores a trashed revision only when its source is active', async () => {
  const onChange=vi.fn().mockResolvedValue(undefined);
  const {rerender}=render(<BudgetVersions {...props} onChange={onChange} revisions={[{...revision,deleted_at:revision.created_at}]} sources={[{...source,deleted_at:source.created_at}]}/>);
  fireEvent.click(screen.getByRole('button',{name:'Koš (2)'}));
  fireEvent.click(screen.getByRole('button',{name:'Obnovit revizi Rozpočet 1'}));
  expect(screen.getByRole('button',{name:'Potvrdit obnovení'})).toBeDisabled();
  rerender(<BudgetVersions {...props} onChange={onChange} revisions={[{...revision,deleted_at:revision.created_at}]}/>);
  fireEvent.click(screen.getByRole('button',{name:'Potvrdit obnovení'}));
  await waitFor(()=>expect(onChange).toHaveBeenCalledWith('r','revision',true,3));
 });
 it('does not offer removal without confirmation or allocation permissions', () => {
  render(<BudgetVersions {...props} permissions={{...props.permissions,confirm:false,allocate:false}}/>);
  expect(screen.queryByRole('button',{name:'Odstranit revizi Rozpočet 1'})).not.toBeInTheDocument();
 });
});
