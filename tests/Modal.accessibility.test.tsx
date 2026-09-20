import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { Modal } from '@shared/ui/Modal';
afterEach(cleanup);
it('names the dialog, contains keyboard focus and returns focus to the opener',()=>{
 function Harness(){const [open,setOpen]=useState(false);return <><button onClick={()=>setOpen(true)}>Otevřít</button>{open&&<Modal isOpen title="Číselník" onClose={()=>setOpen(false)}><input aria-label="Název"/><button>Uložit</button></Modal>}</>;}
 render(<Harness/>);const opener=screen.getByText('Otevřít');opener.focus();fireEvent.click(opener);
 const dialog=screen.getByRole('dialog',{name:'Číselník'});expect(dialog.contains(document.activeElement)).toBe(true);
 const close=screen.getByRole('button',{name:'Zavřít dialog'});close.focus();fireEvent.keyDown(close,{key:'Tab'});expect(screen.getByLabelText('Název')).toHaveFocus();
 fireEvent.keyDown(screen.getByLabelText('Název'),{key:'Escape'});expect(opener).toHaveFocus();
});
it('wraps backwards from the themed select trigger',async()=>{
 const {ThemedNativeSelect}=await import('@shared/ui/ThemedNativeSelect');
 render(<Modal isOpen title="Výběr" onClose={()=>{}}><ThemedNativeSelect aria-label="Číselník" onChange={()=>{}}><option>Štítky</option></ThemedNativeSelect><input aria-label="Název"/></Modal>);
 const select=screen.getByRole('combobox');select.focus();fireEvent.keyDown(select,{key:'Tab',shiftKey:true});expect(screen.getByRole('button',{name:'Zavřít dialog'})).toHaveFocus();
});
