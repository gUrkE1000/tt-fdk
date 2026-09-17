import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Calendar, X, AlertCircle } from 'lucide-react';
import { getShortName } from '../lib/nameUtils';

export default function AbsencesCalendarView() {
  const [absences, setAbsences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string | null>(null);

  const loadAbsences = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('absences')
        .select('*, profiles(name)')
        .order('start_date', { ascending: true });

      if (error) throw error;
      setAbsences(data || []);
    } catch (err) {
      console.error('Error loading absences for calendar:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAbsences();
  }, []);

  // Group absences by day for easy visual lookup
  const getAbsencesForDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const targetDateStr = `${year}-${month}-${day}`;
    return absences.filter((abs) => {
      return abs.start_date <= targetDateStr && abs.end_date >= targetDateStr;
    });
  };

  // Render month calendar grid
  const renderMonthlyCalendarGrid = (monthOffset: number) => {
    const now = new Date();
    const targetMonthDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const month = targetMonthDate.getMonth();
    const year = targetMonthDate.getFullYear();

    const monthName = targetMonthDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

    // Days in Month
    const totalDays = new Date(year, month + 1, 0).getDate();
    // Weekday of 1st day (0 = Sun, 1 = Mon, ..., 6 = Sat)
    // Adjust to Monday-start (0 = Mon, ..., 6 = Sun)
    let firstWeekday = new Date(year, month, 1).getDay();
    firstWeekday = firstWeekday === 0 ? 6 : firstWeekday - 1;

    const days = [];
    // Padding for starting empty cells
    for (let i = 0; i < firstWeekday; i++) {
      days.push(null);
    }
    // Month days
    for (let d = 1; d <= totalDays; d++) {
      days.push(new Date(year, month, d));
    }

    const weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

    return (
      <div className="bg-white p-4 rounded-xl border border-gray-150 shadow-sm space-y-3">
        <h4 className="text-sm font-black text-gray-700 text-center uppercase tracking-wider">{monthName}</h4>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-gray-400">
          {weekdays.map((w) => (
            <div key={w} className="py-1">{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((date, idx) => {
            if (!date) {
              return <div key={`empty-${idx}`} className="aspect-square bg-gray-50/50 rounded-lg"></div>;
            }

            const isToday = date.toDateString() === now.toDateString();
            const absList = getAbsencesForDate(date);
            const dateStr = date.toISOString().split('T')[0];

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedCalendarDay(selectedCalendarDay === dateStr ? null : dateStr)}
                className={`aspect-square rounded-lg flex flex-col justify-between p-1 transition-all border text-left ${
                  isToday
                    ? 'border-teal-500 bg-teal-50/30'
                    : 'border-gray-100 bg-white'
                } ${
                  absList.length > 0
                    ? 'ring-2 ring-rose-300 ring-offset-1 bg-rose-50/30'
                    : ''
                } hover:border-gray-400`}
                title={`${date.toLocaleDateString('de-DE')}${absList.length > 0 ? ` (${absList.length} abwesend)` : ''}`}
              >
                <span className={`text-[10px] font-bold ${isToday ? 'text-teal-600' : 'text-gray-700'}`}>
                  {date.getDate()}
                </span>
                {absList.length > 0 && (
                  <span className="text-[9px] font-black bg-rose-600 text-white rounded-full h-4 w-4 flex items-center justify-center self-end shadow-sm">
                    {absList.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
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
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
            <Calendar className="h-6 w-6 text-teal-600" />
            Abwesenheits-Kalender (Kommende 4 Monate)
          </h2>
          <p className="text-sm text-gray-500">
            Übersicht über alle Spieler, die in den kommenden 4 Monaten abwesend sind (Urlaub, Arbeit, Krankheit).
          </p>
        </div>
      </div>

      {/* Render 4 months calendar grids: 2 months side-by-side, so in total a 2x2 grid on larger screens */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {renderMonthlyCalendarGrid(0)}
        {renderMonthlyCalendarGrid(1)}
        {renderMonthlyCalendarGrid(2)}
        {renderMonthlyCalendarGrid(3)}
      </div>

      {/* Selected Day Details */}
      {selectedCalendarDay && (
        <div className="bg-rose-50/50 border border-rose-200 p-4 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-rose-900">
              ❌ Abwesenheiten am {new Date(selectedCalendarDay).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
            </h4>
            <button
              onClick={() => setSelectedCalendarDay(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2">
            {getAbsencesForDate(new Date(selectedCalendarDay)).length === 0 ? (
              <p className="text-xs text-gray-500 italic">Keine Spieler abwesend an diesem Tag.</p>
            ) : (
              getAbsencesForDate(new Date(selectedCalendarDay)).map((abs) => (
                <div key={abs.id} className="text-xs flex items-center justify-between p-2 bg-white rounded-lg border border-rose-100 shadow-sm">
                  <span className="font-extrabold text-rose-800">{getShortName(abs.profiles?.name || '')}</span>
                  <span className="text-gray-500 italic">
                    {abs.reason ? `💬 ${abs.reason}` : '(Kein Grund angegeben)'} (bis {new Date(abs.end_date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })})
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Absence list view */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-3">
        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Alle registrierten Abwesenheiten</h4>
        <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto border border-gray-150 rounded-xl">
          {absences.length === 0 ? (
            <p className="p-4 text-center text-xs text-gray-400 italic">Keine Abwesenheiten gemeldet.</p>
          ) : (
            absences.map((abs) => {
              const start = new Date(abs.start_date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
              const end = new Date(abs.end_date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

              return (
                <div key={abs.id} className="p-3 flex justify-between items-center text-xs hover:bg-gray-50 bg-white">
                  <div>
                    <span className="font-bold text-gray-800">{getShortName(abs.profiles?.name || '')}</span>
                    <span className="ml-2 text-rose-600 font-semibold bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded text-[10px]">
                      📅 {start === end.slice(0, 5) ? start : `${start} - ${end}`}
                    </span>
                  </div>
                  <span className="text-gray-500 italic text-[11px] truncate max-w-[200px]" title={abs.reason}>
                    {abs.reason || '(Kein Grund)'}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
