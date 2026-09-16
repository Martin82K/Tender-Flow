// Documentation fixture. Only production UI; data and actions are local to this page.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ProjectSidebar } from '@features/projects/ui/ProjectSidebar';
import { BidCard } from '@features/projects/pipeline/ui/BidCard';
import { ContractTenderLinks } from '@features/projects/contracts/workspace/sections/ContractTenderLinks';
import { TenderPlan } from '@features/projects/ui/TenderPlan';
import type { Bid, Project, ProjectDetails, ContractWithDetails, ContactPerson } from '@/types';
import '@/index.css';
import './preview.css';

const contacts: ContactPerson[] = [
  { id: 'anna', name: 'Anna Ukázková', email: 'anna@example.com', phone: '+420 000 000 001' },
  { id: 'petr', name: 'Petr Vzorový', email: 'petr@example.com', phone: '+420 000 000 002' },
];
const initialBids: Bid[] = [
  { id: 'elektro-a', subcontractorId: 'javor', companyName: 'Javor Elektro — ukázka', contactPerson: contacts[0].name, email: contacts[0].email, phone: contacts[0].phone, price: '1 380 000 Kč', status: 'offer', notes: 'Rozvody, zkoušky a revize v ceně.' },
  { id: 'elektro-b', subcontractorId: 'lumen', companyName: 'Lumen Mont — ukázka', contactPerson: 'Eva Příkladová', email: 'eva@example.com', phone: '+420 000 000 003', price: '1 420 000 Kč', status: 'offer' },
  { id: 'elektro-c', subcontractorId: 'voltis', companyName: 'Voltis — ukázka', contactPerson: 'Jan Modelový', email: 'jan@example.com', phone: '+420 000 000 004', price: '1 460 000 Kč', status: 'offer' },
];
const project: Project = { id: 'manual-javor', name: 'Bytový dům Javor', location: 'Ukázková lokalita, Brno', status: 'realization', isDemo: true };
// Partial domain records are sufficient for these read-only components.
const details = { id: project.id, title: project.name, categories: [{ id: 'elektro', title: 'Elektroinstalace' }, { id: 'slaboproud', title: 'Slaboproud' }, { id: 'osvetleni', title: 'Osvětlení' }], bids: { elektro: initialBids, slaboproud: [{ ...initialBids[0], id: 'slabo-a', price: '240 000 Kč' }], osvetleni: [{ ...initialBids[0], id: 'svetlo-a' }] } } as ProjectDetails;
const contract = { id: 'manual-contract', projectId: project.id, title: 'Elektroinstalace a slaboproud', contractNumber: 'JAV-2026-001', linkedBidIds: ['elektro-a', 'slabo-a'], basePrice: 1620000 } as ContractWithDetails;
function Preview() {
  const [bids, setBids] = useState(initialBids);
  const [tab, setTab] = useState('contracts');
  const [settings, setSettings] = useState('dochub');
  return <main className="manual-fixtures tf-app-main">
    <section id="navigation-shot" className="shot">
      <div className="fixture-caption">01 / ORIENTACE VE STAVBĚ <span>Syntetická ukázka</span></div>
      <div className="navigation-layout"><aside className="tf-sidebar"><ProjectSidebar projects={[project]} selectedProjectId={project.id} activeTab={tab} activeSettingsTab={settings} hasFeature={() => true} onSelect={(_, next, setting) => { setTab(next || 'overview'); setSettings(setting || 'pd'); }} /></aside>
      <div className="annotation"><p>BYTOVÝ DŮM JAVOR</p><h1>Vše pro jednu stavbu<br />na jednom místě.</h1><ol><li><strong>Název stavby</strong><br />Otevře přepínač projektů.</li><li><strong>Smlouvy</strong><br />Oddělují objednatele a subdodavatele.</li><li><strong>Nastavení stavby</strong><br />Zde najdete odkazy PD, šablony a Složkomat.</li></ol></div></div>
    </section>
    <section id="bids-shot" className="shot tf-pipeline-view">
      <div className="fixture-caption">02 / ELEKTROINSTALACE <span>Nabídky bez DPH · syntetická data</span></div>
      <h2 className="fixture-title">Tři nabídky. Stejné zadání.</h2><div className="bid-grid">
      {bids.map((bid, index) => <div key={bid.id} className="tf-kanban-column"><BidCard bid={bid} contacts={index === 0 ? contacts : []}
        onSelectRecipient={async (_, contactId) => { const person = contacts.find(item => item.id === contactId); if (person) setBids(current => current.map(item => item.id === bid.id ? { ...item, contactPerson: person.name, email: person.email, phone: person.phone } : item)); }}
        onDragStart={() => {}} onEdit={() => {}} onGenerateInquiry={async () => {}} /></div>)}
      </div><p className="fixture-note">Před vyhodnocením ověřte rozsah, termín a podmínky každé nabídky.</p>
    </section>
    <section id="contract-shot" className="shot tf-contracts-module"><div className="fixture-caption">03 / VAZBY SMLOUVY <span>Syntetická ukázka</span></div>
      <h2 className="fixture-title">JAV-2026-001 · Elektroinstalace a slaboproud</h2><p className="fixture-price">1 620 000 Kč bez DPH <span>Jedna smlouva, dvě výběrová řízení.</span></p>
      <ContractTenderLinks contract={contract} contracts={[contract]} project={details} onRefresh={() => {}} onOpenBid={() => {}} />
      <p className="fixture-note">Propojení zachovává jednu celkovou cenu smlouvy.</p>
    </section>
    <section id="plan-shot" className="shot"><div className="fixture-caption">04 / PLÁN VŘ <span>Bytový dům Javor · syntetická data</span></div><TenderPlan projectId={project.id} categories={details.categories} onCreateCategory={() => {}} /></section>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
