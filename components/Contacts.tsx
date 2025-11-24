
import React, { useState, useMemo, useEffect } from 'react';
import { Header } from './Header';
import { Subcontractor, StatusConfig } from '../types';
import { ALL_CONTACTS } from '../data';
import { getAiSuggestion, findCompanyRegions } from '../services/geminiService';

interface ContactsProps {
    statuses: StatusConfig[];
}

export const Contacts: React.FC<ContactsProps> = ({ statuses }) => {
  // Data State
  const [contacts, setContacts] = useState<Subcontractor[]>(ALL_CONTACTS);
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // AI Modal State
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRegionLoading, setIsRegionLoading] = useState(false);
  
  // Contact Modal State
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Subcontractor | null>(null);
  
  // Form State
  const [formData, setFormData] = useState<Partial<Subcontractor>>({
      company: '',
      name: '',
      specialization: '',
      phone: '',
      email: '',
      ico: '',
      region: '',
      status: 'available'
  });

  // Filter State
  const [searchText, setSearchText] = useState('');
  const [filterSpecialization, setFilterSpecialization] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Get unique specializations for filter and datalist
  const specializations = useMemo(() => {
      const specs = new Set(contacts.map(c => c.specialization));
      return Array.from(specs).sort();
  }, [contacts]);

  // Filter Logic
  const filteredContacts = useMemo(() => {
      return contacts.filter(contact => {
          const matchesSearch = 
            contact.name.toLowerCase().includes(searchText.toLowerCase()) ||
            contact.company.toLowerCase().includes(searchText.toLowerCase()) ||
            contact.email.toLowerCase().includes(searchText.toLowerCase()) ||
            contact.specialization.toLowerCase().includes(searchText.toLowerCase());
          
          const matchesSpec = filterSpecialization === 'all' || contact.specialization === filterSpecialization;
          const matchesStatus = filterStatus === 'all' || contact.status === filterStatus;

          return matchesSearch && matchesSpec && matchesStatus;
      });
  }, [contacts, searchText, filterSpecialization, filterStatus]);

  // --- Helpers for Status ---
  const getStatusConfig = (id: string) => statuses.find(s => s.id === id) || { label: id, color: 'slate', id };

  const getStatusColorClasses = (color: string) => {
      switch (color) {
          case 'green': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
          case 'red': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
          case 'yellow': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
          case 'blue': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
          case 'purple': return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300';
          default: return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300';
      }
  };

  const getStatusDotColor = (color: string) => {
      switch (color) {
          case 'green': return 'bg-green-500';
          case 'red': return 'bg-red-500';
          case 'yellow': return 'bg-yellow-500';
          case 'blue': return 'bg-blue-500';
          case 'purple': return 'bg-purple-500';
          default: return 'bg-slate-500';
      }
  };

  // --- Selection Handlers ---

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) {
          const allIds = new Set(filteredContacts.map(c => c.id));
          setSelectedIds(allIds);
      } else {
          setSelectedIds(new Set());
      }
  };

  const handleSelectOne = (id: string) => {
      const newSelected = new Set(selectedIds);
      if (newSelected.has(id)) {
          newSelected.delete(id);
      } else {
          newSelected.add(id);
      }
      setSelectedIds(newSelected);
  };

  const isAllSelected = filteredContacts.length > 0 && filteredContacts.every(c => selectedIds.has(c.id));
  const isIndeterminate = selectedIds.size > 0 && !isAllSelected;

  // --- AI Handlers ---

  const handleAiSuggest = async () => {
    setShowAiModal(true);
    setAiResponse('');
    setIsLoading(true);
    
    const contextData = JSON.stringify(filteredContacts.slice(0, 50)); 
    const result = await getAiSuggestion(contextData);
    
    setAiResponse(result);
    setIsLoading(false);
  };

  const handleAutoFillRegions = async () => {
      if (selectedIds.size === 0) return;

      const contactsToProcess = contacts.filter(c => selectedIds.has(c.id) && c.ico && c.ico !== '-' && (!c.region || c.region === '-'));
      
      if (contactsToProcess.length === 0) {
          alert("Žádné vybrané kontakty nemají IČO nebo již mají region vyplněný.");
          return;
      }

      setIsRegionLoading(true);
      
      // Prepare data for AI
      const queryList = contactsToProcess.map(c => ({ id: c.id, company: c.company, ico: c.ico }));
      
      const regionsMap = await findCompanyRegions(queryList);
      
      // Update state
      setContacts(prev => prev.map(c => {
          if (regionsMap[c.id]) {
              return { ...c, region: regionsMap[c.id] };
          }
          return c;
      }));

      setIsRegionLoading(false);
      setSelectedIds(new Set()); // Clear selection
  };

  // --- CRUD Handlers ---

  const handleOpenAddModal = () => {
      setEditingContact(null);
      setFormData({
          company: '',
          name: '',
          specialization: '',
          phone: '',
          email: '',
          ico: '',
          region: '',
          status: 'available'
      });
      setIsContactModalOpen(true);
  };

  const handleOpenEditModal = (contact: Subcontractor) => {
      setEditingContact(contact);
      setFormData({ ...contact });
      setIsContactModalOpen(true);
  };

  const handleSaveContact = (e: React.FormEvent) => {
      e.preventDefault();
      
      if (!formData.company || !formData.specialization) return; // Basic validation

      if (editingContact) {
          // Edit existing
          setContacts(prev => prev.map(c => c.id === editingContact.id ? { ...c, ...formData } as Subcontractor : c));
      } else {
          // Add new
          const newContact: Subcontractor = {
              id: `new_${Date.now()}`,
              company: formData.company!,
              name: formData.name || '-',
              specialization: formData.specialization!,
              phone: formData.phone || '-',
              email: formData.email || '-',
              ico: formData.ico || '-',
              region: formData.region || '-',
              status: formData.status || 'available'
          };
          setContacts(prev => [newContact, ...prev]);
      }
      setIsContactModalOpen(false);
  };

  const handleDeleteContact = () => {
      if (editingContact) {
          if (confirm('Opravdu chcete smazat tento kontakt?')) {
              setContacts(prev => prev.filter(c => c.id !== editingContact.id));
              setIsContactModalOpen(false);
          }
      }
  };

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark overflow-y-auto">
      <Header title="Kontakty" subtitle={`Celkem ${contacts.length} subdodavatelů`}>
        <div className="flex items-center gap-2">
            {selectedIds.size > 0 ? (
                <div className="flex items-center gap-2 animate-fade-in bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-lg border border-blue-100 dark:border-blue-800">
                    <span className="text-sm font-bold text-blue-700 dark:text-blue-300 mr-2">
                        {selectedIds.size} vybráno
                    </span>
                    <button 
                        onClick={handleAutoFillRegions}
                        disabled={isRegionLoading}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-sm font-bold shadow-sm transition-colors disabled:opacity-50"
                    >
                        {isRegionLoading ? (
                            <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                        ) : (
                            <span className="material-symbols-outlined text-[18px]">travel_explore</span>
                        )}
                        Doplnit regiony (AI)
                    </button>
                </div>
            ) : (
                <button 
                    onClick={handleAiSuggest}
                    className="flex items-center gap-2 bg-primary/10 dark:bg-primary/20 text-primary dark:text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-primary/20 dark:hover:bg-primary/30 transition-colors"
                >
                    <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                    AI Návrh
                </button>
            )}
            <button 
                onClick={handleOpenAddModal}
                className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors"
            >
                <span className="material-symbols-outlined text-[20px]">add</span>
                Přidat kontakt
            </button>
        </div>
      </Header>

      <div className="p-6 lg:p-10 flex flex-col gap-6">
        {/* Search & Filter Bar */}
        <div className="bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-4">
                 <div className="flex-1 flex items-center rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 h-12">
                    <span className="material-symbols-outlined text-slate-500 dark:text-slate-400">search</span>
                    <input 
                        type="text" 
                        placeholder="Hledat jméno, firmu, specializaci..." 
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        className="flex-1 bg-transparent border-none focus:ring-0 ml-2 text-slate-900 dark:text-white placeholder-slate-500"
                    />
                 </div>
                 
                 <div className="relative w-full md:w-64">
                     <select 
                        value={filterSpecialization}
                        onChange={(e) => setFilterSpecialization(e.target.value)}
                        className="w-full h-12 pl-4 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-200 appearance-none focus:ring-primary focus:border-primary"
                     >
                        <option value="all">Všechny specializace</option>
                        {specializations.map(spec => (
                            <option key={spec} value={spec}>{spec}</option>
                        ))}
                     </select>
                     <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">expand_more</span>
                 </div>

                 <div className="relative w-full md:w-48">
                     <select 
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="w-full h-12 pl-4 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-200 appearance-none focus:ring-primary focus:border-primary"
                     >
                        <option value="all">Všechny stavy</option>
                        {statuses.map(s => (
                            <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                     </select>
                     <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">expand_more</span>
                 </div>
            </div>
            
            {/* Active Filters Tags */}
            {(filterSpecialization !== 'all' || filterStatus !== 'all' || searchText) && (
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                    {filterSpecialization !== 'all' && (
                        <button onClick={() => setFilterSpecialization('all')} className="flex items-center gap-2 bg-primary/10 dark:bg-primary/20 text-primary px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap hover:bg-red-100 hover:text-red-600 transition-colors">
                            {filterSpecialization} <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                    )}
                    {filterStatus !== 'all' && (
                        <button onClick={() => setFilterStatus('all')} className="flex items-center gap-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap hover:bg-red-100 hover:text-red-600 transition-colors">
                            Status: {getStatusConfig(filterStatus).label} <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                    )}
                    {searchText && (
                        <button onClick={() => setSearchText('')} className="flex items-center gap-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap hover:bg-red-100 hover:text-red-600 transition-colors">
                            Hledat: "{searchText}" <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                    )}
                    <button onClick={() => {setFilterSpecialization('all'); setFilterStatus('all'); setSearchText('');}} className="text-xs text-slate-500 hover:text-primary underline ml-2">
                        Vymazat vše
                    </button>
                </div>
            )}
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex-1 flex flex-col">
            <div className="overflow-auto">
                <table className="w-full text-sm text-left text-slate-600 dark:text-slate-400">
                    <thead className="text-xs text-slate-700 dark:text-slate-300 uppercase bg-slate-100 dark:bg-slate-800 border-b dark:border-slate-700 sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-4 w-10">
                                <input 
                                    type="checkbox" 
                                    checked={isAllSelected}
                                    ref={input => { if (input) input.indeterminate = isIndeterminate }}
                                    onChange={handleSelectAll}
                                    className="rounded border-slate-300 text-primary focus:ring-primary dark:bg-slate-700 dark:border-slate-600"
                                />
                            </th>
                            <th className="px-6 py-4 font-medium">Firma</th>
                            <th className="px-6 py-4 font-medium">Specializace</th>
                            <th className="px-6 py-4 font-medium">Kontakt</th>
                            <th className="px-6 py-4 font-medium">Telefon / Email</th>
                            <th className="px-6 py-4 font-medium">IČO</th>
                            <th className="px-6 py-4 font-medium">Region</th>
                            <th className="px-6 py-4 font-medium">Stav</th>
                            <th className="px-6 py-4 font-medium text-right"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredContacts.map((contact) => {
                             const status = getStatusConfig(contact.status);
                             return (
                             <tr key={contact.id} className={`bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group ${selectedIds.has(contact.id) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                                <td className="px-6 py-4">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedIds.has(contact.id)}
                                        onChange={() => handleSelectOne(contact.id)}
                                        className="rounded border-slate-300 text-primary focus:ring-primary dark:bg-slate-700 dark:border-slate-600"
                                    />
                                </td>
                                <td className="px-6 py-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                    {contact.company}
                                </td>
                                <td className="px-6 py-4">
                                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded text-xs whitespace-nowrap">
                                        {contact.specialization}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-slate-900 dark:text-slate-200">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[18px] text-slate-400">person</span>
                                        {contact.name !== '-' ? contact.name : <span className="text-slate-400 italic">Nezadáno</span>}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col gap-1">
                                        {contact.phone !== '-' && (
                                            <div className="flex items-center gap-2 text-xs">
                                                <span className="material-symbols-outlined text-[14px] text-slate-400">call</span>
                                                {contact.phone}
                                            </div>
                                        )}
                                        {contact.email !== '-' && (
                                            <div className="flex items-center gap-2 text-xs">
                                                <span className="material-symbols-outlined text-[14px] text-slate-400">mail</span>
                                                <a href={`mailto:${contact.email}`} className="hover:text-primary hover:underline">{contact.email}</a>
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 font-mono text-xs">
                                    {contact.ico || '-'}
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                                    {contact.region || '-'}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getStatusColorClasses(status.color)}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(status.color)}`}></span> 
                                        {status.label}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button 
                                        onClick={() => handleOpenEditModal(contact)}
                                        className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors opacity-0 group-hover:opacity-100"
                                        title="Upravit"
                                    >
                                        <span className="material-symbols-outlined">edit</span>
                                    </button>
                                </td>
                             </tr>
                        )})}
                        {filteredContacts.length === 0 && (
                            <tr>
                                <td colSpan={9} className="px-6 py-10 text-center text-slate-500 italic">
                                    Nebyly nalezeny žádné kontakty odpovídající filtrům.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500 text-center">
                Zobrazeno {filteredContacts.length} z {contacts.length} kontaktů
            </div>
        </div>
      </div>

      {/* Contact Modal (Add / Edit) */}
      {isContactModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
                  <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                          {editingContact ? 'Upravit kontakt' : 'Přidat nový kontakt'}
                      </h3>
                      <button onClick={() => setIsContactModalOpen(false)} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                          <span className="material-symbols-outlined">close</span>
                      </button>
                  </div>
                  
                  <form onSubmit={handleSaveContact} className="flex flex-col flex-1 overflow-hidden">
                      <div className="p-6 overflow-y-auto flex-1 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Company */}
                              <div className="col-span-2">
                                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Firma / Dodavatel *</label>
                                  <input 
                                      required
                                      type="text" 
                                      value={formData.company} 
                                      onChange={e => setFormData({...formData, company: e.target.value})}
                                      className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                      placeholder="Název firmy"
                                  />
                              </div>

                              {/* Specialization */}
                              <div className="col-span-2">
                                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Specializace / Typ *</label>
                                  <input 
                                      required
                                      type="text" 
                                      list="specializations-list"
                                      value={formData.specialization} 
                                      onChange={e => setFormData({...formData, specialization: e.target.value})}
                                      className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                      placeholder="Např. Elektro Silnoproud"
                                  />
                                  <datalist id="specializations-list">
                                      {specializations.map(spec => (
                                          <option key={spec} value={spec} />
                                      ))}
                                  </datalist>
                              </div>

                              {/* Contact Person */}
                              <div>
                                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Jméno kontaktu</label>
                                  <input 
                                      type="text" 
                                      value={formData.name} 
                                      onChange={e => setFormData({...formData, name: e.target.value})}
                                      className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                      placeholder="Jméno a Příjmení"
                                  />
                              </div>

                              {/* Status */}
                              <div>
                                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Stav</label>
                                  <select
                                      value={formData.status}
                                      onChange={e => setFormData({...formData, status: e.target.value})}
                                      className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                  >
                                      {statuses.map(s => (
                                          <option key={s.id} value={s.id}>{s.label}</option>
                                      ))}
                                  </select>
                              </div>

                              {/* Phone */}
                              <div>
                                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Telefon</label>
                                  <input 
                                      type="text" 
                                      value={formData.phone} 
                                      onChange={e => setFormData({...formData, phone: e.target.value})}
                                      className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                      placeholder="+420 ..."
                                  />
                              </div>

                              {/* Email */}
                              <div>
                                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Email</label>
                                  <input 
                                      type="email" 
                                      value={formData.email} 
                                      onChange={e => setFormData({...formData, email: e.target.value})}
                                      className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                      placeholder="email@example.com"
                                  />
                              </div>

                              {/* ICO */}
                              <div>
                                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">IČO</label>
                                  <input 
                                      type="text" 
                                      value={formData.ico} 
                                      onChange={e => setFormData({...formData, ico: e.target.value})}
                                      className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                      placeholder="12345678"
                                  />
                              </div>

                              {/* Region */}
                              <div>
                                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Region</label>
                                  <input 
                                      type="text" 
                                      value={formData.region} 
                                      onChange={e => setFormData({...formData, region: e.target.value})}
                                      className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:ring-primary focus:border-primary dark:text-white"
                                      placeholder="Praha, Brno..."
                                  />
                              </div>
                          </div>
                      </div>
                      
                      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
                          {editingContact ? (
                              <button 
                                  type="button" 
                                  onClick={handleDeleteContact}
                                  className="text-red-500 hover:text-red-700 text-sm font-medium px-2 py-1"
                              >
                                  Smazat kontakt
                              </button>
                          ) : (
                              <div></div> // Spacer
                          )}
                          <div className="flex gap-2">
                              <button 
                                  type="button" 
                                  onClick={() => setIsContactModalOpen(false)}
                                  className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
                              >
                                  Zrušit
                              </button>
                              <button 
                                  type="submit"
                                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-bold shadow-sm transition-colors"
                              >
                                  {editingContact ? 'Uložit změny' : 'Vytvořit kontakt'}
                              </button>
                          </div>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* AI Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-slate-700">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                         <span className="material-symbols-outlined text-primary">auto_awesome</span>
                         <h3 className="text-lg font-bold text-slate-900 dark:text-white">AI Recommendation</h3>
                    </div>
                    <button onClick={() => setShowAiModal(false)} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div className="p-6">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-8 gap-3">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            <p className="text-sm text-slate-500">Analyzuji kontakty...</p>
                        </div>
                    ) : (
                        <div className="prose dark:prose-invert text-sm max-h-[60vh] overflow-y-auto">
                            <p className="whitespace-pre-wrap">{aiResponse}</p>
                        </div>
                    )}
                </div>
                 <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                    <button 
                        onClick={() => setShowAiModal(false)}
                        className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                        Zavřít
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
