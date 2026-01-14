import React, { useState, useRef, useEffect } from 'react';

interface Option {
    value: string;
    label: string | React.ReactNode;
}

interface SelectProps {
    value: string;
    onChange: (value: string) => void;
    options: Option[];
    placeholder?: string;
    className?: string;
}

export const Select: React.FC<SelectProps> = ({ value, onChange, options, placeholder, className = '' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.value === value);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (val: string) => {
        onChange(val);
        setIsOpen(false);
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    w-full flex items-center justify-between
                    input-polished cursor-pointer
                    text-left bg-white dark:bg-slate-900 
                    text-slate-900 dark:text-slate-200
                    hover:border-slate-300 dark:hover:border-slate-700
                    ${isOpen ? 'ring-2 ring-primary/20 border-primary' : ''}
                `}
            >
                <span className="truncate mr-2">
                    {selectedOption ? selectedOption.label : <span className="text-slate-400">{placeholder || 'Select...'}</span>}
                </span>
                <span className={`material-symbols-outlined text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                    expand_more
                </span>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden max-h-[300px] overflow-y-auto">
                        {options.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => handleSelect(option.value)}
                                className={`
                                    w-full text-left px-4 py-2.5 text-sm transition-colors
                                    flex items-center justify-between
                                    ${option.value === value
                                        ? 'bg-primary/5 text-primary font-medium'
                                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }
                                `}
                            >
                                <span className="truncate">{option.label}</span>
                                {option.value === value && (
                                    <span className="material-symbols-outlined text-[18px]">check</span>
                                )}
                            </button>
                        ))}
                        {options.length === 0 && (
                            <div className="px-4 py-3 text-sm text-slate-500 text-center">
                                No options available
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
