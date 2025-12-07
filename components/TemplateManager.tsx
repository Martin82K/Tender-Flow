import React, { useState, useEffect } from 'react';
import { Template, ProjectDetails } from '../types';
import { TEMPLATE_VARIABLES, getPreviewData, processTemplate } from '../utils/templateUtils';
import { getTemplates, saveTemplate, deleteTemplate as serviceDeleteTemplate } from '../services/templateService';

interface TemplateManagerProps {
    project?: ProjectDetails;
    onSelectTemplate?: (template: Template) => void;
    onClose?: () => void;
}

export const TemplateManager: React.FC<TemplateManagerProps> = ({ project, onSelectTemplate, onClose }) => {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [previewMode, setPreviewMode] = useState(false);
    
    // Editor State
    const [editedName, setEditedName] = useState('');
    const [editedSubject, setEditedSubject] = useState('');
    const [editedContent, setEditedContent] = useState('');

    useEffect(() => {
        setTemplates(getTemplates());
    }, []);

    useEffect(() => {
        if (!selectedTemplateId && templates.length > 0) {
            setSelectedTemplateId(templates[0].id);
        }
    }, [templates]);

    const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

    useEffect(() => {
        if (selectedTemplate) {
            setEditedName(selectedTemplate.name);
            setEditedSubject(selectedTemplate.subject);
            setEditedContent(selectedTemplate.content);
        }
    }, [selectedTemplate]);

    const handleSave = () => {
        if (!selectedTemplateId) return;
        
        const updatedTemplate: Template = {
            id: selectedTemplateId,
            name: editedName,
            subject: editedSubject,
            content: editedContent,
            isDefault: selectedTemplate?.isDefault || false,
            lastModified: new Date().toISOString().split('T')[0]
        };
        
        saveTemplate(updatedTemplate);
        setTemplates(getTemplates());
        setEditMode(false);
    };

    const handleCreateNew = () => {
        const newId = Date.now().toString();
        const newTemplate: Template = {
            id: newId,
            name: 'Nová šablona',
            subject: 'Poptávka: {NAZEV_STAVBY}',
            content: 'Dobrý den,\n\n...',
            isDefault: false,
            lastModified: new Date().toISOString().split('T')[0]
        };
        saveTemplate(newTemplate);
        setTemplates(getTemplates());
        setSelectedTemplateId(newId);
        setEditMode(true);
    };

    const handleDelete = (id: string) => {
        if (confirm('Opravdu chcete smazat tuto šablonu?')) {
            serviceDeleteTemplate(id);
            const newTemplates = getTemplates();
            setTemplates(newTemplates);
            if (selectedTemplateId === id) {
                setSelectedTemplateId(newTemplates[0]?.id || null);
            }
        }
    };

    const wrapSelection = (tag: string) => {
        const textarea = document.getElementById('template-content') as HTMLTextAreaElement;
        if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = textarea.value;
            const selection = text.substring(start, end);
            
            // If nothing selected, just insert empty tags
            const newText = text.substring(0, start) + `<${tag}>${selection}</${tag}>` + text.substring(end);
            setEditedContent(newText);
            
            // Restore focus and cursor inside the tag
            setTimeout(() => {
                textarea.focus();
                const newCursorPos = start + tag.length + 2 + selection.length;
                textarea.setSelectionRange(newCursorPos, newCursorPos);
            }, 0);
        }
    };

    const insertVariable = (code: string) => {
        const textarea = document.getElementById('template-content') as HTMLTextAreaElement;
        if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = textarea.value;
            const newText = text.substring(0, start) + code + text.substring(end);
            setEditedContent(newText);
            
            // Restore focus and cursor
            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(start + code.length, start + code.length);
            }, 0);
        } else {
            setEditedContent(prev => prev + code);
        }
    };

    const previewData = getPreviewData(project);

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-lg">
                        <span className="material-symbols-outlined text-primary">mail_outline</span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Správce šablon</h2>
                </div>
                {onClose && (
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                )}
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar List */}
                <div className="w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                        <button 
                            onClick={handleCreateNew}
                            className="w-full py-2 px-4 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center justify-center gap-2 font-medium text-sm"
                        >
                            <span className="material-symbols-outlined text-[20px]">add</span>
                            Nová šablona
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {templates.map(template => (
                            <div 
                                key={template.id}
                                onClick={() => {
                                    if (!editMode) setSelectedTemplateId(template.id);
                                    else if (confirm('Máte neuložené změny. Chcete je zahodit?')) {
                                        setEditMode(false);
                                        setSelectedTemplateId(template.id);
                                    }
                                }}
                                className={`p-3 rounded-lg cursor-pointer transition-all border ${
                                    selectedTemplateId === template.id 
                                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 ring-1 ring-blue-200 dark:ring-blue-800' 
                                        : 'bg-white dark:bg-slate-800 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700'
                                }`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <h4 className={`font-medium text-sm ${selectedTemplateId === template.id ? 'text-primary' : 'text-slate-900 dark:text-white'}`}>
                                        {template.name}
                                    </h4>
                                    {template.isDefault && (
                                        <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded font-bold">DEF</span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{template.subject}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden">
                    {selectedTemplate ? (
                        <>
                            {/* Toolbar */}
                            <div className="px-6 py-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    {!editMode ? (
                                        <>
                                            <button 
                                                onClick={() => setEditMode(true)}
                                                className="px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-600 flex items-center gap-2"
                                            >
                                                <span className="material-symbols-outlined text-[18px]">edit</span>
                                                Upravit
                                            </button>
                                            <button 
                                                onClick={() => setPreviewMode(!previewMode)}
                                                className={`px-3 py-1.5 text-sm font-medium border rounded-md flex items-center gap-2 ${
                                                    previewMode 
                                                        ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' 
                                                        : 'text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 hover:bg-slate-50'
                                                }`}
                                            >
                                                <span className="material-symbols-outlined text-[18px]">visibility</span>
                                                {previewMode ? 'Zobrazit kód' : 'Náhled'}
                                            </button>
                                            {onSelectTemplate && (
                                                <button 
                                                    onClick={() => onSelectTemplate(selectedTemplate)}
                                                    className="ml-2 px-3 py-1.5 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 flex items-center gap-2"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">check</span>
                                                    Použít tuto šablonu
                                                </button>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <button 
                                                onClick={handleSave}
                                                className="px-3 py-1.5 text-sm font-medium text-white bg-primary border border-transparent rounded-md hover:bg-primary-dark flex items-center gap-2"
                                            >
                                                <span className="material-symbols-outlined text-[18px]">save</span>
                                                Uložit
                                            </button>
                                            <button 
                                                onClick={() => setEditMode(false)}
                                                className="px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-600"
                                            >
                                                Zrušit
                                            </button>
                                        </>
                                    )}
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    {!editMode && (
                                        <button 
                                            onClick={() => handleDelete(selectedTemplate.id)}
                                            className="text-red-500 hover:text-red-700 p-2"
                                            title="Smazat šablonu"
                                        >
                                            <span className="material-symbols-outlined">delete</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Editor/Preview Area */}
                            <div className="flex-1 overflow-y-auto p-6">
                                {editMode ? (
                                    <div className="max-w-4xl mx-auto space-y-6">
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                                    Název šablony (interní)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={editedName}
                                                    onChange={(e) => setEditedName(e.target.value)}
                                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-primary"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                                    Předmět emailu
                                                </label>
                                                <input
                                                    type="text"
                                                    value={editedSubject}
                                                    onChange={(e) => setEditedSubject(e.target.value)}
                                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-primary"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                            <div className="lg:col-span-2 space-y-2">
                                                <div className="flex justify-between items-center mb-1">
                                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                                        Obsah (HTML)
                                                    </label>
                                                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => wrapSelection('b')}
                                                            className="p-1.5 hover:bg-white dark:hover:bg-slate-600 rounded text-slate-600 dark:text-slate-300 font-bold"
                                                            title="Tučně"
                                                        >
                                                            B
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => wrapSelection('i')}
                                                            className="p-1.5 hover:bg-white dark:hover:bg-slate-600 rounded text-slate-600 dark:text-slate-300 italic font-serif"
                                                            title="Kurzíva"
                                                        >
                                                            I
                                                        </button>
                                                        <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>
                                                        <button
                                                            type="button"
                                                            onClick={() => insertVariable('<br>\n')}
                                                            className="p-1.5 hover:bg-white dark:hover:bg-slate-600 rounded text-slate-600 dark:text-slate-300 text-xs font-mono"
                                                            title="Nový řádek"
                                                        >
                                                            BR
                                                        </button>
                                                    </div>
                                                </div>
                                                <textarea
                                                    id="template-content"
                                                    value={editedContent}
                                                    onChange={(e) => setEditedContent(e.target.value)}
                                                    className="w-full h-[400px] px-3 py-2 font-mono text-sm border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-primary"
                                                />
                                                <p className="text-xs text-slate-500">
                                                    Tip: Můžete použít HTML tagy jako &lt;b&gt;tučné&lt;/b&gt;, &lt;br&gt; pro nový řádek.
                                                </p>
                                            </div>
                                            
                                            {/* Variables Helper */}
                                            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 h-fit">
                                                <h4 className="font-semibold text-sm text-slate-900 dark:text-white mb-3">
                                                    Vložit proměnnou
                                                </h4>
                                                <div className="space-y-4">
                                                    {['Project', 'Financial', 'Contact'].map(cat => (
                                                        <div key={cat}>
                                                            <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{cat === 'Project' ? 'Projekt' : cat === 'Financial' ? 'Finance' : 'Kontakt'}</h5>
                                                            <div className="flex flex-wrap gap-2">
                                                                {TEMPLATE_VARIABLES.filter(v => v.category === cat).map(variable => (
                                                                    <button
                                                                        key={variable.code}
                                                                        onClick={() => insertVariable(variable.code)}
                                                                        className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-slate-600 rounded border border-slate-200 dark:border-slate-600 transition-colors"
                                                                        title={variable.description}
                                                                    >
                                                                        {variable.code}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="max-w-4xl mx-auto">
                                        {/* View Mode */}
                                        <div className="mb-8">
                                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                                                {previewMode ? processTemplate(selectedTemplate.subject, previewData) : selectedTemplate.subject}
                                            </h3>
                                            <div className="flex items-center gap-4 text-sm text-slate-500">
                                                <span>Název: {selectedTemplate.name}</span>
                                                <span>•</span>
                                                <span>Naposledy upraveno: {selectedTemplate.lastModified}</span>
                                            </div>
                                        </div>

                                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-8 shadow-sm min-h-[400px]">
                                            <div 
                                                className="prose dark:prose-invert max-w-none"
                                                dangerouslySetInnerHTML={{ 
                                                    __html: (previewMode ? processTemplate(selectedTemplate.content, previewData) : selectedTemplate.content).replace(/\n/g, '<br/>') 
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                            <span className="material-symbols-outlined text-6xl mb-4">mail</span>
                            <p>Vyberte šablonu k úpravě nebo vytvořte novou</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
