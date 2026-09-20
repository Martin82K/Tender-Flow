import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BudgetExportDialog } from '@features/projects/budget/ui/BudgetExportDialog';
import { exportBudget } from '@features/projects/budget/api/budgetExport';
vi.mock('@features/projects/budget/api/budgetExport',()=>({exportBudget:vi.fn()}));
beforeEach(()=>vi.clearAllMocks());
const props={nodes:[],allocations:[],categories:[{id:'vr',title:'Zemní práce'}],onClose:vi.fn()};
it('selects tender scope independently of the optional price output',()=>{
 render(<BudgetExportDialog {...props} canViewPrices/>);
 fireEvent.change(screen.getByLabelText('Rozsah exportu'),{target:{value:'tender'}});
 expect(screen.getByText('Stáhnout XLSX')).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Výběrové řízení'),{target:{value:'vr'}});
 fireEvent.click(screen.getByText('Stáhnout XLSX'));
 expect(exportBudget).toHaveBeenLastCalledWith([],'poptavkovy-soupis.xlsx',expect.objectContaining({scope:{kind:'tender',categoryId:'vr',title:'Zemní práce'},includePrices:false}));
 fireEvent.click(screen.getByLabelText('Zahrnout ceny rozpočtu'));fireEvent.click(screen.getByText('Stáhnout XLSX'));
 expect(exportBudget).toHaveBeenLastCalledWith([],'rozpocet-s-cenami.xlsx',expect.objectContaining({includePrices:true}));
});
it('never enables prices without permission and preserves explicit item selection',()=>{
 render(<BudgetExportDialog {...props} canViewPrices={false} selectedIds={['item']}/>);
 expect(screen.getByLabelText('Zahrnout ceny rozpočtu')).toBeDisabled();
 fireEvent.click(screen.getByText('Stáhnout XLSX'));
 expect(exportBudget).toHaveBeenCalledWith([],'poptavkovy-soupis.xlsx',expect.objectContaining({scope:{kind:'selection',itemIds:['item']},includePrices:false,canViewPrices:false}));
});
