import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

interface PasswordGateProps {
  onVerified: (password: string) => void;
}

export default function PasswordGate({ onVerified }: PasswordGateProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const checkPassword = async (pwToVerify: string, isAuto = false) => {
    if (!pwToVerify.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { data: isValid, error: rpcError } = await supabase.rpc('verify_club_password', {
        password: pwToVerify,
      });

      if (rpcError) {
        throw rpcError;
      }

      if (isValid) {
        localStorage.setItem('club_password', pwToVerify);
        onVerified(pwToVerify);
      } else {
        if (!isAuto) {
          setError('Ungültiges Vereinspasswort. Bitte versuche es erneut.');
        }
      }
    } catch (err: any) {
      console.error('Error verifying club password:', err);
      if (!isAuto) {
        setError('Verbindungsfehler zum Server. Bitte später versuchen.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pwParam = params.get('pw') || params.get('password');
    if (pwParam) {
      checkPassword(pwParam, true);
      return;
    }

    const storedPw = localStorage.getItem('club_password');
    if (storedPw) {
      checkPassword(storedPw, true);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    checkPassword(password);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-800 to-teal-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center border border-teal-100">
        <div className="text-5xl mb-4">🏓</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Spielbereitschafts-Planer</h1>
        <p className="text-gray-600 text-sm mb-6">
          Diese Anwendung ist passwortgeschützt. Bitte gib das Passwort deines Vereins ein, um fortzufahren.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-left text-xs font-semibold text-gray-600 uppercase mb-1">
              Vereinspasswort
            </label>
            <input
              type="password"
              placeholder="Passwort eingeben"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-center text-lg tracking-widest"
              required
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm font-medium">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="inline-block animate-spin rounded-full h-5 w-5 border-t-2 border-r-2 border-white"></span>
            ) : (
              'Einloggen'
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 text-xs text-gray-500">
          Tipp: Nutze einen Link wie <code className="bg-gray-100 px-1 py-0.5 rounded text-teal-700">?pw=DEIN_PASSWORT</code>, um das Passwort automatisch zu hinterlegen.
        </div>
      </div>
    </div>
  );
}
