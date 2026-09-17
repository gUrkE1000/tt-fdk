import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getShortName } from '../lib/nameUtils';

interface AuthScreenProps {
  onSelectPlayer: (profile: any) => void;
}

export default function AuthScreen({ onSelectPlayer }: AuthScreenProps) {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'dropdown' | 'password' | 'register'>('dropdown');

  // Input states for password login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Input states for registration
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('name');

        if (error) throw error;
        const list = data || [];
        setProfiles(list);

        // Pre-select cached player if exists
        const cachedId = localStorage.getItem('ttv_selected_player_id');
        if (cachedId && list.some((p) => p.id === cachedId)) {
          setSelectedId(cachedId);
        } else if (list.length > 0) {
          setSelectedId(list[0].id);
        }
      } catch (err: any) {
        console.error('Error fetching profiles:', err);
        setError('Fehler beim Laden der Spielerliste.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfiles();
  }, []);

  const handleDropdownLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) {
      setError('Bitte wähle einen Spieler aus.');
      return;
    }

    const player = profiles.find((p) => p.id === selectedId);
    if (player) {
      localStorage.setItem('ttv_login_method', 'passwordless');
      localStorage.setItem('ttv_selected_player_id', player.id);
      onSelectPlayer(player);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Bitte Email und Passwort eingeben.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authErr) throw authErr;

      if (data && data.user) {
        // Fetch profile associated with this user
        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (profErr || !prof) {
          throw new Error('Dein Benutzerprofil konnte nicht gefunden werden.');
        }

        localStorage.setItem('ttv_login_method', 'password');
        localStorage.setItem('ttv_selected_player_id', prof.id);
        onSelectPlayer(prof);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Fehler beim Login. Bitte überprüfe deine Daten.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPassword) {
      setError('Bitte fülle alle Felder aus.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const { data, error: regErr } = await supabase.auth.signUp({
        email: regEmail.trim(),
        password: regPassword,
        options: {
          data: {
            name: regName.trim(),
          },
        },
      });

      if (regErr) throw regErr;

      // Wenn die E-Mail-Bestätigung deaktiviert ist, erhalten wir direkt eine Session
      if (data && data.session && data.user) {
        // Profil abrufen
        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (!profErr && prof) {
          localStorage.setItem('ttv_login_method', 'password');
          localStorage.setItem('ttv_selected_player_id', prof.id);
          onSelectPlayer(prof);
          return;
        }
      }

      alert('Registrierung erfolgreich! Bitte melde dich jetzt an.');
      setEmail(regEmail.trim());
      setActiveTab('password');
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'Fehler bei der Registrierung.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-teal-600 mx-auto"></div>
          <p className="text-sm font-semibold text-gray-500">Lade Spieler...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 border border-gray-100 text-center space-y-6">
        <div className="text-4xl">🏓</div>
        <div>
          <h2 className="text-2xl font-black text-gray-800">TTV Spielplaner</h2>
          <p className="text-sm text-gray-500 mt-1">Anmeldung für Vereinsmitglieder</p>
        </div>

        {/* Tab-Leiste */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => { setActiveTab('dropdown'); setError(''); }}
            className={`flex-1 pb-3 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'dropdown'
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Direkt-Auswahl
          </button>
          <button
            onClick={() => { setActiveTab('password'); setError(''); }}
            className={`flex-1 pb-3 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'password'
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Mit Passwort
          </button>
          <button
            onClick={() => { setActiveTab('register'); setError(''); }}
            className={`flex-1 pb-3 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'register'
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Registrieren
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium text-left">
            ⚠️ {error}
          </div>
        )}

        {/* 1. PASSWORTLOSE DIREKTAUSWAHL */}
        {activeTab === 'dropdown' && (
          <form onSubmit={handleDropdownLogin} className="space-y-4">
            <div className="text-left">
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                Dein Name / Profil
              </label>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-base"
                required
              >
                <option value="" disabled>-- Bitte wählen --</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {getShortName(p.name)} {p.ttr_points ? `(${p.ttr_points} TTR)` : ''}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-amber-600 font-medium mt-1">
                Hinweis: Ohne Passwort-Anmeldung stehen dir nur einfache Spieler-Rechte zur Verfügung.
              </p>
            </div>

            <button
              type="submit"
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-md transition-all transform active:scale-95 flex items-center justify-center gap-2 text-base"
            >
              Anmelden (Passwortlos)
            </button>
          </form>
        )}

        {/* 2. ANMELDUNG MIT PASSWORT */}
        {activeTab === 'password' && (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div className="text-left space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                  E-Mail Adresse
                </label>
                <input
                  type="email"
                  placeholder="name@verein.de"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-base"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                  Passwort
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-base"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-md transition-all transform active:scale-95 flex items-center justify-center gap-2 text-base disabled:opacity-50"
            >
              {submitting ? 'Melde an...' : 'Anmelden'}
            </button>
          </form>
        )}

        {/* 3. REGISTRIERUNG */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="text-left space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                  Voller Name
                </label>
                <input
                  type="text"
                  placeholder="z.B. Max Mustermann"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-base"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                  E-Mail Adresse
                </label>
                <input
                  type="email"
                  placeholder="name@verein.de"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-base"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                  Passwort (min. 6 Zeichen)
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-base"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-md transition-all transform active:scale-95 flex items-center justify-center gap-2 text-base disabled:opacity-50"
            >
              {submitting ? 'Registriere...' : 'Registrieren'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
