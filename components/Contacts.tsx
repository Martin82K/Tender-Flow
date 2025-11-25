
import React, { useState } from 'react';
import { Header } from './Header';
import { Subcontractor, StatusConfig } from '../types';
import { getAiSuggestion, findCompanyRegions } from '../services/geminiService';
import { SubcontractorSelector } from './SubcontractorSelector';

interface ContactsProps {
    statuses: StatusConfig[];
    contacts: Subcontractor[];
    onContactsChange: (contacts: Subcontractor[]) => void;
}

export const Contacts: React.FC<ContactsProps> = ({ statuses, contacts, onContactsChange }) => {
  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Filtered Data State (received from child)
  const [filteredContacts, setFilteredContacts] = useState<Subcontractor[]>(contacts);

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

  // --- AI Handlers ---

  const handleAiSuggest = async () => {
    setShowAiModal(true);
    setAiResponse('');
    setIsLoading(true);
    
    // Use the filtered list from the child component
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
      
      // Update props via handler
      const updatedContacts = contacts.map(c => {
          if (regionsMap[c.id]) {
              return { ...c, region: regionsMap[c.id] };
          }
          return c;
      });
      onContactsChange(updatedContacts);

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
          const updatedContacts = contacts.map(c => c.id === editingContact.id ? { ...c, ...formData } as Subcontractor : c);
          onContactsChange(updatedContacts);
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
          onContactsChange([newContact, ...contacts]);
      }
      setIsContactModalOpen(false);
  };

  const handleDeleteContact = () => {
      if (editingContact) {
          if (confirm('Opravdu chcete smazat tento kontakt?')) {
              const updatedContacts = contacts.filter(c => c.id !== editingContact.id);
              onContactsChange(updatedContacts);
              setIsContactModalOpen(false);
          }
      }
  };

  // Get unique specializations for datalist (re-calculate here for the form, or export from selector? simpler to recalc)
  const allSpecializations = Array.from(new Set(contacts.map(c => c.specialization))).sort();

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

      <div className="p-6 lg:p-10 flex-1 flex flex-col min-h-0">
         <SubcontractorSelector 
            contacts={contacts}
            statuses={statuses}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            onFilteredContactsChange={setFilteredContacts}
            onEditContact={handleOpenEditModal}
            className="flex-1 min-h-0"
         />
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
                                      {allSpecializations.map(spec => (
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

