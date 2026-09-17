import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Calendar, Trash2, Plus, AlertCircle, Sparkles } from 'lucide-react';

interface AbsencesViewProps {
  userId: string;
}

export default function AbsencesView({ userId }: AbsencesViewProps) {
  const [absences, setAbsences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadAbsences = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('absences')
        .select('*')
        .eq('player_id', userId)
        .order('start_date', { ascending: true });

      if (error) throw error;
      setAbsences(data || []);
    } catch (err) {
      console.error('Error loading absences:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAbsences();
  }, [userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!startDate || !endDate) {
      setError('Bitte wähle ein Start- und Enddatum.');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      setError('Das Enddatum darf nicht vor dem Startdatum liegen.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('absences').insert({
        player_id: userId,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim() || null,
      });

      if (error) throw error;

      // Reset form
      setStartDate('');
      setEndDate('');
      setReason('');
      loadAbsences();
      alert('Abwesenheit erfolgreich eingetragen!');
    } catch (err: any) {
      console.error('Error adding absence:', err);
      setError('Fehler beim Eintragen: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Möchtest du diese Abwesenheit wirklich löschen?')) return;

    try {
      const { error } = await supabase.from('absences').delete().eq('id', id);
      if (error) throw error;
      loadAbsences();
      alert('Abwesenheit gelöscht!');
    } catch (err: any) {
      console.error('Error deleting absence:', err);
      alert('Fehler beim Löschen: ' + err.message);
    }
  };

  const formatDateGerman = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Description Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
            📅 Mein Abwesenheits-Kalender
          </h2>
          <p className="text-sm text-gray-500">
            Trage hier Tage ein, an denen du nicht spielen kannst (z. B. Urlaub, Arbeit, Krankheit). Der Sportwart sieht diese Termine gesammelt in seiner Planung.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Form Column */}
        <div className="md:col-span-1">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-gray-800 flex items-center gap-1.5">
              <Plus className="h-5 w-5 text-teal-600" />
              Abwesenheit eintragen
            </h3>

            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-semibold flex items-start gap-1.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Erster Tag (Start)</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (!endDate) setEndDate(e.target.value); // Auto fill end date
                  }}
                  className="w-full px-4 py-2.5 border rounded-xl bg-white text-sm outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Letzter Tag (Ende)</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-xl bg-white text-sm outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Grund (optional)</label>
                <input
                  type="text"
                  placeholder="z.B. Urlaub, Spätschicht, Krank"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-xl bg-white text-sm outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-6 rounded-xl shadow-md transition-all transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                Eintragen
              </button>
            </form>
          </div>
        </div>

        {/* List Column */}
        <div className="md:col-span-2">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-gray-800 flex items-center gap-1.5">
              <Calendar className="h-5 w-5 text-gray-500" />
              Eingetragene Abwesenheiten ({absences.length})
            </h3>

            <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
              {absences.length === 0 ? (
                <div className="text-center p-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <Sparkles className="h-8 w-8 text-teal-500 mx-auto opacity-40 mb-2" />
                  <p className="text-sm text-gray-500 italic">Du hast noch keine Abwesenheiten eingetragen. Wenn du an bestimmten Spieltagen keine Zeit hast, trage das einfach links ein!</p>
                </div>
              ) : (
                absences.map((abs) => {
                  const isSingleDay = abs.start_date === abs.end_date;

                  return (
                    <div key={abs.id} className="flex items-center justify-between p-4 bg-gray-50 border border-gray-150 rounded-xl hover:border-gray-200 transition-all">
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-gray-800">
                          {isSingleDay ? (
                            <span>{formatDateGerman(abs.start_date)}</span>
                          ) : (
                            <span>
                              {formatDateGerman(abs.start_date)} bis {formatDateGerman(abs.end_date)}
                            </span>
                          )}
                        </p>
                        {abs.reason && (
                          <p className="text-xs text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full inline-block font-medium">
                            💬 {abs.reason}
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => handleDelete(abs.id)}
                        className="p-2 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors shrink-0"
                        title="Abwesenheit löschen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
