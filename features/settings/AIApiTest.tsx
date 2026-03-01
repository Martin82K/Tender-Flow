import React, { useState, useRef, useEffect } from 'react';
import { invokeAuthedFunction } from '../../services/functionsClient';

// Types
type AIProvider = 'openrouter' | 'google' | 'mistral';

interface ChatMessage {
    role: 'user' | 'assistant' | 'model';
    parts: string | any[];
    timestamp: number;
}

interface LogEntry {
    timestamp: Date;
    type: 'info' | 'success' | 'error' | 'request' | 'response';
    message: string;
    details?: any;
}

export const AIApiTest: React.FC = () => {
    // Configuration State
    const [provider, setProvider] = useState<AIProvider>('openrouter');
    const [model, setModel] = useState('gpt-5-mini');

    // Chat State
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Diagnostics State
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [showLogs] = useState(true);
    const logsEndRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll logs and chat
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Update default model when provider changes
    useEffect(() => {
        if (provider === 'google') {
            setModel(prev => prev.includes('gemini') ? prev : 'gemini-1.5-pro');
        } else if (provider === 'mistral') {
            setModel(prev => prev.includes('mistral') ? prev : 'mistral-small-latest');
        } else {
            setModel(prev => prev || 'gpt-5-mini');
        }
    }, [provider]);

    const addLog = (type: LogEntry['type'], message: string, details?: any) => {
        setLogs(prev => [...prev, { timestamp: new Date(), type, message, details }]);
    };

    const callProxy = async (currentInput?: string) => {
        const payload = {
            prompt: currentInput || '',
            history: messages.map(m => ({ role: m.role, parts: m.parts })),
            model,
            provider,
        };

        return invokeAuthedFunction<{ text: string; raw?: any; error?: string }>('ai-proxy', {
            body: payload,
        });
    };

    const handleTestConnection = async () => {
        setIsLoading(true);
        addLog('info', `Spouštím serverový test pro ${provider} (Supabase Secrets)...`, { model });

        try {
            const start = performance.now();
            const responseJson = await invokeAuthedFunction<{ text: string; raw?: any; error?: string }>('ai-proxy', {
                body: {
                    prompt: 'Odpověz jedním slovem: OK',
                    history: [],
                    model,
                    provider,
                },
            });

            if (responseJson.error) throw new Error(responseJson.error);

            const duration = Math.round(performance.now() - start);
            if (responseJson.text) {
                addLog('success', `Test úspěšný (${duration}ms)`, responseJson);
            } else {
                addLog('error', 'Odpověď neobsahuje text', responseJson);
            }
        } catch (error: any) {
            addLog('error', 'Test selhal', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendMessage = async () => {
        if (!input.trim()) return;

        const userMsg: ChatMessage = { role: 'user', parts: input, timestamp: Date.now() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        addLog('request', 'Odesílám zprávu přes ai-proxy (server-only klíče)', {
            provider,
            model,
            message: input,
        });

        try {
            const start = performance.now();
            const responseJson = await callProxy(input);
            if (responseJson.error) throw new Error(responseJson.error);

            const duration = Math.round(performance.now() - start);
            const text = responseJson.text || '';

            if (text) {
                const botMsg: ChatMessage = {
                    role: 'assistant',
                    parts: text,
                    timestamp: Date.now(),
                };
                setMessages(prev => [...prev, botMsg]);
                addLog('response', `Odpověď přijata (${duration}ms)`, responseJson.raw ?? responseJson);
            } else {
                addLog('error', 'Prázdná odpověď od AI', responseJson);
            }
        } catch (error: any) {
            addLog('error', 'Chyba při komunikaci', error);
            setMessages(prev => [
                ...prev,
                {
                    role: 'assistant',
                    parts: `⚠️ Chyba: ${error?.message || 'Unknown error'}`,
                    timestamp: Date.now(),
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const clearLogs = () => setLogs([]);
    const clearChat = () => setMessages([]);

    return (
        <div className="flex flex-col h-[calc(100vh-200px)] gap-4 animate-fadeIn">

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap gap-4 items-end">
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Poskytovatel</label>
                    <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
                        <button
                            onClick={() => setProvider('openrouter')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${provider === 'openrouter' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            OpenRouter
                        </button>
                        <button
                            onClick={() => setProvider('google')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${provider === 'google' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            Google Gemini
                        </button>
                        <button
                            onClick={() => setProvider('mistral')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${provider === 'mistral' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            Mistral
                        </button>
                    </div>
                </div>

                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Model</label>
                    <input
                        type="text"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        placeholder="Např. gpt-5-mini"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-indigo-500 dark:text-white"
                    />
                </div>

                <div className="flex-1 min-w-[260px] p-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
                        Server-only mode: API klíče jsou načítány výhradně ze Supabase Secrets.
                    </p>
                </div>

                <button
                    onClick={handleTestConnection}
                    disabled={isLoading}
                    className="px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-50"
                    title="Spustit test"
                >
                    <span className="material-symbols-outlined text-[18px]">network_check</span>
                    Ping Test
                </button>
            </div>

            <div className="flex-1 flex gap-4 overflow-hidden">
                <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px]">chat</span>
                            Chat Session
                        </span>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">
                                {messages.length} zpráv
                            </span>
                            <button onClick={clearChat} className="text-slate-400 hover:text-indigo-500 transition-colors p-1" title="Vymazat chat">
                                <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950/30">
                        {messages.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50">
                                <span className="material-symbols-outlined text-6xl mb-2">forum</span>
                                <p className="text-sm">Zahajte konverzaci...</p>
                                <p className="text-xs mt-1">Chatuje s modelem: {model}</p>
                            </div>
                        )}
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${msg.role === 'user'
                                    ? 'bg-indigo-600 text-white rounded-tr-none'
                                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-tl-none'
                                    }`}>
                                    <div className="whitespace-pre-wrap text-sm">{typeof msg.parts === 'string' ? msg.parts : JSON.stringify(msg.parts)}</div>
                                    <div className={`text-[10px] mt-1 opacity-70 ${msg.role === 'user' ? 'text-indigo-200' : 'text-slate-400'}`}>
                                        {new Date(msg.timestamp).toLocaleTimeString()}
                                    </div>
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                                placeholder="Napište zprávu..."
                                disabled={isLoading}
                                className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={isLoading || !input.trim()}
                                className={`px-4 rounded-xl flex items-center justify-center transition-all ${input.trim() && !isLoading
                                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                                    }`}
                            >
                                {isLoading ? (
                                    <span className="material-symbols-outlined animate-spin">refresh</span>
                                ) : (
                                    <span className="material-symbols-outlined">send</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                <div className={`w-[400px] flex flex-col bg-slate-900 rounded-2xl border border-slate-800 shadow-lg overflow-hidden transition-all duration-300 transform ${showLogs ? 'translate-x-0' : 'translate-x-full absolute right-0'}`}>
                    <div className="p-3 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px]">terminal</span>
                            Diagnostika
                        </span>
                        <button onClick={clearLogs} className="text-slate-600 hover:text-red-400 transition-colors p-1" title="Vymazat logy">
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-2 font-mono text-xs bg-black/20">
                        {logs.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-slate-700">
                                <span className="material-symbols-outlined text-4xl mb-2">bug_report</span>
                                <p>Žádné záznamy</p>
                            </div>
                        )}
                        {logs.map((log, i) => (
                            <div key={i} className="mb-2 p-2 rounded bg-slate-800/50 border border-slate-800">
                                <div className="flex justify-between items-center mb-1 text-[10px] text-slate-500">
                                    <span>{log.timestamp.toLocaleTimeString()}.{log.timestamp.getMilliseconds().toString().padStart(3, '0')}</span>
                                    <span className={`uppercase font-bold px-1.5 py-0.5 rounded text-[9px] ${log.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' :
                                        log.type === 'error' ? 'bg-red-500/10 text-red-500' :
                                            log.type === 'request' ? 'bg-blue-500/10 text-blue-500' :
                                                log.type === 'response' ? 'bg-purple-500/10 text-purple-500' :
                                                    'bg-slate-500/10 text-slate-400'
                                        }`}>{log.type}</span>
                                </div>
                                <div className="text-slate-300 mb-1 break-words">{log.message}</div>
                                {log.details && (
                                    <div className="bg-slate-950 p-2 rounded overflow-x-auto text-slate-500 max-h-[200px] scrollbar-thin border border-slate-800/50">
                                        <pre>{JSON.stringify(log.details, null, 2)}</pre>
                                    </div>
                                )}
                            </div>
                        ))}
                        <div ref={logsEndRef} />
                    </div>
                </div>

            </div>
        </div>
    );
};
