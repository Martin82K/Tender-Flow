// Documentation-only preview: production components with synthetic data, no backend.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BidRecipientPicker } from '@/features/projects/pipeline/ui/BidRecipientPicker';
import { ContractTenderLinks } from '@/features/projects/contracts/workspace/sections/ContractTenderLinks';
import type { Bid, ContractWithDetails, ProjectDetails } from '@/types';
import '@/index.css';
import './preview.css';
const contacts = [{id:'a',name:'Jan Novák',email:'jan@example.com',phone:'+420 000 000 001'}, {id:'b',name:'Eva Novotná',email:'eva@example.com',phone:'+420 000 000 002'}];
const initial = {id:'bid-a',companyName:'Ukázkový dodavatel A',contactPerson:contacts[0].name,email:contacts[0].email,phone:contacts[0].phone,status:'contacted'} as Bid;
const second = {...initial,id:'bid-b',companyName:'Ukázkový dodavatel B',contactPerson:contacts[1].name,email:contacts[1].email,phone:contacts[1].phone};
const contract = {id:'contract',projectId:'demo',linkedBidIds:['bid-a']} as ContractWithDetails;
const project = {id:'demo',categories:[{id:'a',title:'Montážní práce'},{id:'b',title:'Elektroinstalace'},{id:'c',title:'Dokončovací práce'}],bids:{a:[initial],b:[second],c:[{...second,id:'bid-c'}]}} as unknown as ProjectDetails;
function Preview(){
 const [bid,setBid]=useState(initial);
 return <main className="tf-app-main tf-pipeline-view"><h1>Ukázka funkcí - syntetická data</h1><div className="cards">
 <article><h2>{bid.companyName}</h2><BidRecipientPicker bid={bid} contacts={contacts} disabled={false} onSavingChange={()=>{}} onSelect={async(_,id)=>{const c=contacts.find(c=>c.id===id)!;setBid({...bid,contactPerson:c.name,email:c.email,phone:c.phone});}} /></article>
 <article><h2>{second.companyName}</h2><BidRecipientPicker bid={second} contacts={[contacts[1]]} disabled={false} onSavingChange={()=>{}} onSelect={async()=>{}} /></article>
 </div><div className="contract"><ContractTenderLinks contract={contract} contracts={[contract]} project={project} onRefresh={()=>{}} onOpenBid={()=>{}} /></div></main>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
