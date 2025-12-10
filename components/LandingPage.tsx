import React, { useState } from 'react';
import logo from '../assets/logo.png';
import { ConstructionBackground } from './ConstructionBackground';

interface LandingPageProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister?: (name: string, email: string, password: string) => Promise<void>;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLogin, onRegister }) => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLoginMode) {
        await onLogin(email, password);
      } else {
        if (password !== confirmPassword) {
          throw new Error('Hesla se neshodují');
        }
        if (onRegister) {
          await onRegister(name, email, password);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Nastala chyba');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async () => {
    setLoading(true);
    try {
      await onLogin('martin@example.com', 'password');
    } catch (err) {
      setError('Quick login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gray-900 relative overflow-hidden">
      {/* Background Animation */}
      <div className="absolute inset-0 z-0">
        <ConstructionBackground />
      </div>

      {/* Content Container */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-4xl px-4">

        {/* Logo Section */}
        <div className="mb-8 transform hover:scale-105 transition-transform duration-500">
          <img
            src={logo}
            alt="Tender Flow Logo"
            className="w-48 h-48 object-contain drop-shadow-2xl"
          />
        </div>

        {/* Title Section */}
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-light text-white tracking-wider mb-2">
            Tender Flow
          </h1>
          <p className="text-sm md:text-base text-white/70 font-light tracking-wide">
            Tender Management System
          </p>
          <div className="h-1 w-32 bg-orange-500 mx-auto rounded-full mt-4" />
        </div>

        {/* Action Buttons */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
          {!isLoginMode && (
            <div className="flex flex-col gap-1">
              <input
                type="text"
                placeholder="Jméno a Příjmení"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                required
              />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <input
              type="password"
              placeholder="Heslo"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
              required
            />
          </div>

          {!isLoginMode && (
            <div className="flex flex-col gap-1">
              <input
                type="password"
                placeholder="Potvrzení hesla"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                required
              />
            </div>
          )}

          {error && (
            <div className="text-red-400 text-sm text-center bg-red-500/10 py-2 rounded-lg border border-red-500/20">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 px-8 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium text-lg transition-all duration-300 transform hover:-translate-y-1 shadow-lg hover:shadow-orange-500/30 mt-2"
          >
            {loading ? 'Pracuji...' : (isLoginMode ? 'Přihlásit se' : 'Vytvořit účet')}
          </button>

          <div className="flex items-center justify-between text-sm text-white/40 mt-4">
            <button type="button" className="hover:text-white transition-colors">Zapomenuté heslo?</button>
            <button
              type="button"
              onClick={() => setIsLoginMode(!isLoginMode)}
              className="hover:text-white transition-colors"
            >
              {isLoginMode ? 'Vytvořit účet' : 'Již mám účet'}
            </button>
          </div>

          {/* Version Label */}
          <div className="mt-8 pt-8 border-t border-white/10 text-center">
            <span className="text-xs text-white/40">verze 0.4.2</span>
          </div>
        </form>

      </div>

      {/* Footer */}
      <div className="absolute bottom-8 text-center w-full z-10">
        <p className="text-white/60 text-sm font-light">
          Navrhl a vytvořil - <span className="text-orange-500 font-normal">Martin Kalkuš</span>
        </p>
      </div>
    </div>
  );
};
