import React, { useState } from 'react';
import { Header } from './Header';
import { Subcontractor } from '../types';
import { getAiSuggestion } from '../services/geminiService';

const MOCK_CONTACTS: Subcontractor[] = [
  { id: '1', name: 'Jan Novák', company: 'Stavby Novák s.r.o.', specialization: 'Vnitřní omítky', phone: '+420 123 456 789', email: 'jan.novak@stavby.cz', status: 'available' },
  { id: '2', name: 'Petr Dvořák', company: 'Elektro Dvořák', specialization: 'Elektroinstalace', phone: '+420 987 654 321', email: 'petr@elektrodvorak.cz', status: 'busy' },
  { id: '3', name: 'Tomáš Svoboda', company: 'Instalatérství Svoboda', specialization: 'Voda, topení, plyn', phone: '+420 234 567 890', email: 'tomas.svoboda@vtp.cz', status: 'available' },
  { id: '4', name: 'Martin Černý', company: 'Pokrývačství Černý', specialization: 'Střechy', phone: '+420 345 678 901', email: 'cerny@strechy-praha.cz', status: 'waiting' },
  { id: '5', name: 'Lucie Veselá', company: 'Design Veselá', specialization: 'Interiérový design', phone: '+420 456 789 012', email: 'lucie@designvesela.cz', status: 'available' },
];

export const Contacts: React.FC = () => {
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAiSuggest = async () => {
    setShowAiModal(true);
    setAiResponse('');
    setIsLoading(true);
    
    const contextData = JSON.stringify(MOCK_CONTACTS);
    const result = await getAiSuggestion(contextData);
    
    setAiResponse(result);
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark overflow-y-auto">
      <Header title="Kontakty">
        <button 
            onClick={handleAiSuggest}
            className="flex items-center gap-2 bg-primary/10 dark:bg-primary/20 text-primary dark:text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-primary/20 dark:hover:bg-primary/30 transition-colors"
        >
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            AI Návrh
        </button>
        <button className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors">
            Přidat kontakt
        </button>
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
                        className="flex-1 bg-transparent border-none focus:ring-0 ml-2 text-slate-900 dark:text-white placeholder-slate-500"
                    />
                 </div>
                 <button className="flex items-center justify-between w-full md:w-64 h-12 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-200">
                    <span>Specializace: Vše</span>
                    <span className="material-symbols-outlined">expand_more</span>
                 </button>
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                 <span className="flex items-center gap-2 bg-primary/10 dark:bg-primary/20 text-primary px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap">
                    Vnitřní omítky <span className="material-symbols-outlined text-[16px] cursor-pointer">close</span>
                 </span>
                 <span className="flex items-center gap-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap">
                    Elektroinstalace <span className="material-symbols-outlined text-[16px] cursor-pointer">close</span>
                 </span>
                 <span className="flex items-center gap-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap">
                    Stav: K dispozici <span className="material-symbols-outlined text-[16px] cursor-pointer">close</span>
                 </span>
            </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-600 dark:text-slate-400">
                    <thead className="text-xs text-slate-700 dark:text-slate-300 uppercase bg-slate-100 dark:bg-slate-800 border-b dark:border-slate-700">
                        <tr>
                            <th className="px-6 py-4 font-medium">Jméno</th>
                            <th className="px-6 py-4 font-medium">Firma</th>
                            <th className="px-6 py-4 font-medium">Specializace</th>
                            <th className="px-6 py-4 font-medium">Telefon</th>
                            <th className="px-6 py-4 font-medium">Email</th>
                            <th className="px-6 py-4 font-medium">Stav</th>
                            <th className="px-6 py-4 font-medium text-right"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {MOCK_CONTACTS.map((contact) => (
                             <tr key={contact.id} className="bg-white dark:bg-slate-900/50 border-b dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{contact.name}</td>
                                <td className="px-6 py-4">{contact.company}</td>
                                <td className="px-6 py-4">{contact.specialization}</td>
                                <td className="px-6 py-4">{contact.phone}</td>
                                <td className="px-6 py-4">{contact.email}</td>
                                <td className="px-6 py-4">
                                    {contact.status === 'available' && (
                                        <span className="inline-flex items-center gap-1.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-2.5 py-1 rounded-full text-xs font-medium">
                                            <span className="w-2 h-2 rounded-full bg-green-500"></span> K dispozici
                                        </span>
                                    )}
                                    {contact.status === 'busy' && (
                                        <span className="inline-flex items-center gap-1.5 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 px-2.5 py-1 rounded-full text-xs font-medium">
                                            <span className="w-2 h-2 rounded-full bg-red-500"></span> Zaneprázdněn
                                        </span>
                                    )}
                                    {contact.status === 'waiting' && (
                                        <span className="inline-flex items-center gap-1.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 px-2.5 py-1 rounded-full text-xs font-medium">
                                            <span className="w-2 h-2 rounded-full bg-yellow-500"></span> Čeká na materiál
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors">
                                        <span className="material-symbols-outlined">more_horiz</span>
                                    </button>
                                </td>
                             </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      </div>

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
                        <div className="prose dark:prose-invert text-sm">
                            <p className="whitespace-pre-wrap">{aiResponse}</p>
                        </div>
                    )}
                </div>
                 <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                    <button 
                        onClick={() => setShowAiModal(false)}
                        className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};