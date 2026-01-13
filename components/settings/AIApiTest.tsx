import React, { useState, useRef, useEffect } from 'react';
import { invokeAuthedFunction } from '../../services/functionsClient';

// Types
type AIProvider = 'openrouter' | 'google';

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
    const [apiKey, setApiKey] = useState(() => localStorage.getItem('tender_flow_ai_key_openrouter') || '');
    const [model, setModel] = useState('x-ai/grok-4.1-fast');

    // Chat State
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Diagnostics State
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [showLogs, setShowLogs] = useState(true);
    const logsEndRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Persist API Key changes
    useEffect(() => {
        if (provider === 'openrouter') {
            localStorage.setItem('tender_flow_ai_key_openrouter', apiKey);
        } else if (provider === 'google') {
            localStorage.setItem('tender_flow_ai_key_google', apiKey);
        }
    }, [apiKey, provider]);

    // Load API Key when provider changes
    useEffect(() => {
        if (provider === 'openrouter') {
            setApiKey(localStorage.getItem('tender_flow_ai_key_openrouter') || '');
        } else if (provider === 'google') {
            setApiKey(localStorage.getItem('tender_flow_ai_key_google') || '');
        }
    }, [provider]);

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
        } else if (provider === 'openrouter') {
            setModel('x-ai/grok-4.1-fast'); // Requested by user
        }
    }, [provider]);

    const addLog = (type: LogEntry['type'], message: string, details?: any) => {
        setLogs(prev => [...prev, { timestamp: new Date(), type, message, details }]);
    };

    const callProviderDirectly = async (messages: ChatMessage[], currentInput?: string) => {
        const history = messages.map(m => ({
            role: m.role,
            parts: m.parts
        }));

        if (currentInput) {
            history.push({ role: 'user', parts: currentInput });
        }

        if (!apiKey) {
            throw new Error("Chybí API Klíč! Pro přímý režim je nutné ho zadat.");
        }

        // --- GOOGLE DIRECT ---
        if (provider === 'google') {
            const googleModel = model || 'gemini-1.5-pro';
            // Map messages to Google format
            const contents = history.map((msg: any) => ({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: Array.isArray(msg.parts) ? msg.parts.map((p: any) => p.text).join('') : (typeof msg.parts === 'string' ? msg.parts : JSON.stringify(msg.parts)) }]
            }));

            const url = `https://generativelanguage.googleapis.com/v1beta/models/${googleModel}:generateContent?key=${apiKey}`;

            // Log full request for debugging
            addLog('request', `Calling Google API Direct`, { url, body: { contents } });

            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents }),
            });

            const data = await response.json();

            if (!response.ok) throw new Error(data.error?.message || 'Google API Error');

            return {
                text: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
                raw: data
            };
        }

        // --- OPENROUTER DIRECT ---
        if (provider === 'openrouter') {
            // Map messages to OpenAI format
            const routerMessages = history.map(msg => ({
                role: msg.role === 'model' ? 'assistant' : msg.role,
                content: typeof msg.parts === 'string' ? msg.parts : JSON.stringify(msg.parts)
            }));

            const url = "https://openrouter.ai/api/v1/chat/completions";
            const payload = {
                model: model || "x-ai/grok-4.1-fast",
                messages: routerMessages,
            };

            // Sanitize key
            const sanitizedKey = apiKey.trim();
            const authHeader = `Bearer ${sanitizedKey}`;

            // Log masked auth for debugging (show first 10, last 4 chars)
            const maskedKey = sanitizedKey.length > 10
                ? `${sanitizedKey.substring(0, 7)}...${sanitizedKey.substring(sanitizedKey.length - 4)}`
                : 'INVALID_KEY_LENGTH';

            addLog('request', `Calling OpenRouter API Direct`, {
                url,
                payload,
                authDebug: {
                    headerPrefix: 'Bearer',
                    keyLength: sanitizedKey.length,
                    maskedKey
                }
            });

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": authHeader,
                    "HTTP-Referer": "https://tenderflow.cz",
                    "X-Title": "Tender Flow Test"
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message || 'OpenRouter API Error');

            return {
                text: data.choices?.[0]?.message?.content || "",
                raw: data
            };
        }

        throw new Error("Unknown provider for direct call");
    };

    // State for System Key usage
    const [useSystemKey, setUseSystemKey] = useState(false);

    const handleTestConnection = async () => {
        if (!apiKey && !useSystemKey) {
            addLog('error', 'Chybí API Klíč', 'Pro test je nutné vyplnit API klíč nebo použít systémový.');
            return;
        }

        setIsLoading(true);
        addLog('info', `Spouštím DIRECT test pro ${provider} (${useSystemKey ? 'System Key' : 'Custom Key'})...`, { model });

        try {
            const start = performance.now();
            let response;
            if (useSystemKey) {
                // Call Proxy
                const responseJson = await invokeAuthedFunction<{ text: string, raw: any, error?: string }>('ai-proxy', {
                    body: {
                        prompt: 'Odpověz jedním slovem: OK',
                        history: [],
                        model: model,
                        provider: provider,
                        apiKey: '' // Empty key signals proxy to use system secret
                    }
                });

                if (responseJson.error) throw new Error(responseJson.error);
                response = { text: responseJson.text, raw: responseJson.raw ?? responseJson };
            } else {
                // Direct call as before
                response = await callProviderDirectly([], 'Odpověz jedním slovem: OK');
            }

            const duration = Math.round(performance.now() - start);

            if (response && response.text) {
                addLog('success', `Test úspěšný (${duration}ms)`, response);
            } else {
                addLog('error', 'Odpověď neobsahuje text', response);
            }
        } catch (error: any) {
            addLog('error', 'Test selhal', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendMessage = async () => {
        if (!input.trim()) return;
        if (!apiKey && !useSystemKey) {
            addLog('error', 'Chybí API Klíč', 'Pro chat je nutné vyplnit API klíč nebo použít systémový.');
            return;
        }

        const userMsg: ChatMessage = { role: 'user', parts: input, timestamp: Date.now() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        addLog('request', `Odesílám zprávu (${useSystemKey ? 'PROXY/System' : 'DIRECT/Custom'})`, {
            provider,
            model,
            message: input
        });

        try {
            const start = performance.now();
            let response;

            if (useSystemKey) {
                // Proxy call for Chat
                const payload = {
                    prompt: input,
                    history: messages.map(m => ({ role: m.role, parts: m.parts })),
                    model: model,
                    provider: provider,
                    apiKey: '' // Empty key -> System Secret
                };

                const responseJson = await invokeAuthedFunction<{ text: string, raw: any, error?: string }>('ai-proxy', {
                    body: payload
                });

                if (responseJson.error) throw new Error(responseJson.error);
                response = { text: responseJson.text, raw: responseJson.raw ?? responseJson };
            } else {
                response = await callProviderDirectly(messages, input);
            }

            const duration = Math.round(performance.now() - start);

            if (response.text) {
                const botMsg: ChatMessage = { role: 'assistant', parts: response.text, timestamp: Date.now() };
                setMessages(prev => [...prev, botMsg]);
                addLog('response', `Odpověď přijata (${duration}ms)`, response.raw);
            } else {
                addLog('error', 'Prázdná odpověď od AI', response);
            }

        } catch (error: any) {
            console.error(error);
            addLog('error', 'Chyba při komunikaci', error);
            setMessages(prev => [...prev, { role: 'assistant', parts: `⚠️ Chyba: ${error.message || 'Unknown error'}`, timestamp: Date.now() }]);
        } finally {
            setIsLoading(false);
        }
    };

    const clearLogs = () => setLogs([]);
    const clearChat = () => setMessages([]);

    return (
        <div className="flex flex-col h-[calc(100vh-200px)] gap-4 animate-fadeIn">

            {/* Header / Config Bar */}
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
                    </div>
                </div>

                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Model</label>
                    <input
                        type="text"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        placeholder="Např. x-ai/grok-4.1-fast"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-indigo-500 dark:text-white"
                    />
                </div>

                <div className="flex-1 min-w-[200px]">
                    <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs font-semibold text-slate-500">
                            API Klíč
                            {!useSystemKey && <span className="text-red-500 ml-1 text-[10px] uppercase tracking-wider">Direct Mode</span>}
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={useSystemKey}
                                onChange={(e) => setUseSystemKey(e.target.checked)}
                                className="w-3 h-3 rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-xs text-indigo-600 font-bold">Použít systémový klíč</span>
                        </label>
                    </div>

                    <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={useSystemKey ? "Používá se uložený klíč v systému..." : "Vložte váš API klíč..."}
                        disabled={useSystemKey}
                        className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border rounded-xl text-sm focus:outline-none focus:border-indigo-500 dark:text-white placeholder:text-slate-400 transition-colors ${!apiKey && !useSystemKey ? 'border-red-300 dark:border-red-900 focus:border-red-500' : 'border-slate-300 dark:border-slate-800'} ${useSystemKey ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                </div>

                <button
                    onClick={handleTestConnection}
                    disabled={isLoading || (!apiKey && !useSystemKey)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 ${(!apiKey && !useSystemKey)
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                        : 'bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                    title={!apiKey && !useSystemKey ? "Vyplňte API klíč" : "Spustit test"}
                >
                    <span className="material-symbols-outlined text-[18px]">network_check</span>
                    Ping Test
                </button>
            </div>

            {/* Main Content Area: Chat + Logs */}
            <div className="flex-1 flex gap-4 overflow-hidden">

                {/* Chat Section */}
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
                                placeholder={!apiKey && !useSystemKey ? "Pro chatování vyplňte API klíč nahoře..." : "Napište zprávu..."}
                                disabled={isLoading || (!apiKey && !useSystemKey)}
                                className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={isLoading || !input.trim() || (!apiKey && !useSystemKey)}
                                className={`px-4 rounded-xl flex items-center justify-center transition-all ${input.trim() && !isLoading && (apiKey || useSystemKey)
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

                {/* Diagnostics Panel */}
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
