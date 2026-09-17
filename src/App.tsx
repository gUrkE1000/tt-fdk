import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import PasswordGate from './components/PasswordGate';
import AuthScreen from './components/AuthScreen';
import TeamTabView from './components/TeamTabView';
import TeamMatrixView from './components/TeamMatrixView';
import GesamtUebersichtView from './components/GesamtUebersichtView';
import AdminDashboard from './components/AdminDashboard';
import SportwartView from './components/SportwartView';
import AbsencesView from './components/AbsencesView';
import AbsencesCalendarView from './components/AbsencesCalendarView';
import GuideView from './components/GuideView';
import { Shield, LogOut, User as UserIcon, Calendar, Grid, Award, Eye, ClipboardList, BookOpen } from 'lucide-react';

export default function App() {
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [previousLoginAt, setPreviousLoginAt] = useState<string | null>(null);
  const [teams, setTeams] = useState<any[]>([]);

  // Tab-state
  // 'team-{teamId}' or 'gesamt' or 'absences' or 'absences-calendar' or 'sportwart' or 'admin'
  const [activeTab, setActiveTab] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Load user profile and active teams
  const loadProfileAndTeams = async (profileId: string) => {
    setLoading(true);
    try {
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .single();

      if (profErr || !prof) {
        console.error('Error loading profile:', profErr);
        localStorage.removeItem('ttv_selected_player_id');
        setProfile(null);
        setSession(null);
      } else {
        const loginMethod = localStorage.getItem('ttv_login_method') || 'passwordless';
        const finalProfile = {
          ...prof,
          role: loginMethod === 'passwordless' ? 'player' : prof.role,
        };

        // Capture previous last_login_at timestamp before updating it
        if (prof.last_login_at) {
          setPreviousLoginAt(prof.last_login_at);
        } else {
          // Default fallback: 24 hours ago
          setPreviousLoginAt(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
        }

        // Asynchronously record current login timestamp
        try {
          await supabase
            .from('profiles')
            .update({ last_login_at: new Date().toISOString() })
            .eq('id', profileId);
        } catch (e) {
          // Ignore timestamp update errors
        }

        setProfile(finalProfile);
        setSession({ user: { id: prof.id, email: '' } });

        // Fetch active teams
        const { data: teamsData, error: teamsErr } = await supabase
          .from('teams')
          .select('*')
          .eq('active', true)
          .order('name');

        if (teamsErr) {
          console.error('Error loading teams:', teamsErr);
        } else {
          const activeTeams = teamsData || [];
          setTeams(activeTeams);

          // Default to player's primary listed team if possible
          // "der Tab der Mannschaft in der er gelistet ist, soll dann beim Start ausgewählt sein. jeder Spieler soll aber alle tabs sehen können."
          if (prof.team_number && activeTeams.length >= prof.team_number) {
            setActiveTab(`team-${activeTeams[prof.team_number - 1].id}`);
          } else if (activeTeams.length > 0) {
            setActiveTab(`team-${activeTeams[0].id}`);
          } else {
            setActiveTab('gesamt');
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check if password has already been verified previously
    const verified = localStorage.getItem('club_password');
    if (verified) {
      setIsPasswordVerified(true);
    } else {
      // Check URL parameters for bypass
      const params = new URLSearchParams(window.location.search);
      const pwParam = params.get('pw') || params.get('password');
      if (pwParam) {
        setIsPasswordVerified(true);
      }
    }
  }, []);

  useEffect(() => {
    if (isPasswordVerified) {
      const cachedId = localStorage.getItem('ttv_selected_player_id');
      if (cachedId) {
        loadProfileAndTeams(cachedId);
      } else {
        // Load active teams so teams are populated even if no player is logged in yet
        const fetchTeams = async () => {
          try {
            const { data: teamsData } = await supabase
              .from('teams')
              .select('*')
              .eq('active', true)
              .order('name');
            setTeams(teamsData || []);
          } catch (e) {
            console.error(e);
          } finally {
            setLoading(false);
          }
        };
        fetchTeams();
      }
    }
  }, [isPasswordVerified]);

  const handleLogout = () => {
    localStorage.removeItem('ttv_selected_player_id');
    localStorage.removeItem('ttv_login_method');
    supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  };

  const clearClubPassword = () => {
    localStorage.removeItem('club_password');
    setIsPasswordVerified(false);
  };

  const handleSelectPlayer = (selectedProfile: any) => {
    loadProfileAndTeams(selectedProfile.id);
  };

  if (!isPasswordVerified) {
    return <PasswordGate onVerified={() => setIsPasswordVerified(true)} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-teal-600 mx-auto"></div>
          <p className="text-sm font-semibold text-gray-500">Lade Spieldaten...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <AuthScreen onSelectPlayer={handleSelectPlayer} />;
  }

  const isClubAdmin = profile?.role === 'club_admin';
  const isSportwart = profile?.role === 'sportwart';
  const isManagerOrAdmin = profile?.role === 'team_manager' || isSportwart || isClubAdmin;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 1. Header Bar */}
      <header className="bg-white border-b border-gray-150 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏓</span>
            <div>
              <h1 className="text-base sm:text-lg font-black text-gray-800 tracking-tight">TTV Spielplaner</h1>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Spielbereitschaft</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-bold text-gray-700">{profile?.name}</span>
              <span className="text-[9px] font-extrabold text-teal-700 uppercase tracking-widest">
                {profile?.role === 'club_admin' ? 'Admin' : profile?.role === 'sportwart' ? 'Sportwart' : profile?.role === 'team_manager' ? 'Mannschaftsführer' : 'Spieler'}
              </span>
            </div>

            <div className="h-8 w-8 bg-teal-50 border border-teal-200 text-teal-700 rounded-full flex items-center justify-center font-bold text-sm" title={profile?.name}>
              {profile?.name?.substring(0, 2).toUpperCase() || 'P'}
            </div>

            <button
              onClick={handleLogout}
              className="p-2 bg-gray-100 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-colors text-gray-600"
              title="Abmelden"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. Horizontal Scrollable Navigation Tabs */}
      <nav className="bg-white border-b border-gray-100 sticky top-[57px] z-40 overflow-x-auto no-scrollbar shadow-sm">
        <div className="max-w-6xl mx-auto px-4 flex gap-1.5 py-2.5">
          {teams.map((team) => (
            <button
              key={team.id}
              onClick={() => setActiveTab(`team-${team.id}`)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all border shrink-0 ${
                activeTab === `team-${team.id}`
                  ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                  : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-150'
              }`}
            >
              🏅 {team.name}
            </button>
          ))}

          <button
            onClick={() => setActiveTab('gesamt')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all border shrink-0 ${
              activeTab === 'gesamt'
                ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-150'
            }`}
          >
            🗓️ Gesamtübersicht
          </button>

          <button
            onClick={() => setActiveTab('absences')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all border shrink-0 ${
              activeTab === 'absences'
                ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-150'
            }`}
          >
            📅 Mein Kalender
          </button>

          {isManagerOrAdmin && (
            <button
              onClick={() => setActiveTab('absences-calendar')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all border shrink-0 ${
                activeTab === 'absences-calendar'
                  ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                  : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-150'
              }`}
            >
              🗓️ Abwesenheits-Kalender
            </button>
          )}

          <button
            onClick={() => setActiveTab('guide')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all border shrink-0 ${
              activeTab === 'guide'
                ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-150'
            }`}
          >
            📖 Anleitung
          </button>

          {(isSportwart || isClubAdmin) && (
            <button
              onClick={() => setActiveTab('sportwart')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all border shrink-0 ${
                activeTab === 'sportwart'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
              }`}
            >
              📋 Sportwart
            </button>
          )}

          {isClubAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all border shrink-0 ${
                activeTab === 'admin'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
              }`}
            >
              🛡️ Admin
            </button>
          )}
        </div>
      </nav>

      {/* 3. Main tab content area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 pb-24">
        {activeTab.startsWith('team-') && (
          <div className="space-y-8">
            {/* Team Matches Feed */}
            <TeamTabView
              teamId={activeTab.replace('team-', '')}
              userId={session.user.id}
              userRole={profile?.role}
              isClubAdmin={isClubAdmin}
              previousLoginAt={previousLoginAt}
            />

            {/* Matrix View */}
            <TeamMatrixView
              teamId={activeTab.replace('team-', '')}
              isManagerOrAdmin={isManagerOrAdmin}
            />
          </div>
        )}

        {activeTab === 'gesamt' && <GesamtUebersichtView />}

        {activeTab === 'absences' && <AbsencesView userId={profile.id} />}

        {activeTab === 'absences-calendar' && isManagerOrAdmin && <AbsencesCalendarView />}

        {activeTab === 'guide' && <GuideView role={profile?.role} />}

        {activeTab === 'sportwart' && (isSportwart || isClubAdmin) && <SportwartView />}

        {activeTab === 'admin' && isClubAdmin && <AdminDashboard />}
      </main>

      {/* 4. Footer */}
      <footer className="bg-white border-t border-gray-150 py-4 text-center text-xs text-gray-400 mt-auto">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} TTV Spielbereitschafts-Planer</p>
          {isClubAdmin && (
            <div className="flex gap-4">
              <button onClick={clearClubPassword} className="hover:text-rose-600 font-semibold underline">
                Sicherheit: Passwort-Gate zurücksetzen
              </button>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
