import React, { useMemo, useState } from 'react';
import { Award, TrendingUp, History, Bell, MapPin, BarChart2, Edit2, X, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../store';

export default function Savings() {
  const savingsHistory = useAppStore(state => state.savingsHistory);
  const monthlyGoal = useAppStore(state => state.monthlyGoal);
  const setMonthlyGoal = useAppStore(state => state.setMonthlyGoal);

  const [showGoalModal, setShowGoalModal] = useState(false);
  const [newGoalValue, setNewGoalValue] = useState(monthlyGoal.toString());

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const totalSavingsThisMonth = useMemo(() => {
    return savingsHistory
      .filter(s => {
        const d = new Date(s.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [savingsHistory, currentMonth, currentYear]);

  const percentage = Math.min(100, monthlyGoal > 0 ? (totalSavingsThisMonth / monthlyGoal) * 100 : 0);
  const remaining = Math.max(0, monthlyGoal - totalSavingsThisMonth);

  const handleSaveGoal = () => {
    const parsed = Number(newGoalValue);
    if (!isNaN(parsed) && parsed > 0) {
      setMonthlyGoal(parsed);
      setShowGoalModal(false);
    }
  };

  const recentSavings = useMemo(() => {
    return [...savingsHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
  }, [savingsHistory]);

  const hasStreak = savingsHistory.length >= 3;
  const hasBulkMaster = savingsHistory.some(s => s.amount > 50);
  const hasFreshSaver = savingsHistory.length > 0;

  return (
    <div className="max-w-md mx-auto pb-6 space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900 font-display tracking-tight">Bula!</h1>
        <p className="text-slate-500 mt-1 font-medium">Your digital curator is tracking your savings.</p>
      </div>

      <div className="bg-gradient-to-br from-[#0097b2] to-[#007b99] text-white rounded-[2rem] p-8 shadow-lg shadow-cyan-900/20 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs font-bold text-cyan-100 uppercase tracking-wider">Total Savings This Month</p>
            <button onClick={() => { setNewGoalValue(monthlyGoal.toString()); setShowGoalModal(true); }} className="text-cyan-100 hover:text-white transition-colors" title="Edit Goal">
              <Edit2 className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-baseline gap-2 mb-8">
            <span className="text-2xl font-bold text-cyan-200">FJD</span>
            <span className="text-6xl font-black tracking-tighter font-display">${totalSavingsThisMonth.toFixed(2)}</span>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-sm font-bold">
              <span className="text-cyan-50">Savings Momentum</span>
              <span className="text-white">{percentage.toFixed(0)}% of Goal</span>
            </div>
            <div className="h-2.5 bg-black/20 rounded-full overflow-hidden backdrop-blur-sm">
              <div 
                className="h-full bg-gradient-to-r from-yellow-400 to-yellow-300 rounded-full relative transition-all duration-1000"
                style={{ width: `${percentage}%` }}
              >
                <div className="absolute inset-0 bg-white/20 w-full animate-pulse"></div>
              </div>
            </div>
            <p className="text-xs font-medium text-cyan-100">
              {remaining > 0 ? `You're $${remaining.toFixed(2)} away from your monthly target` : 'You have reached your monthly target!'}
            </p>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute -right-12 -top-12 w-48 h-48 bg-white/10 rounded-full blur-2xl"></div>
        <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-black/10 rounded-full blur-2xl"></div>
      </div>

      <div>
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-2xl font-bold text-slate-900 font-display">Achievement Badges</h2>
        </div>
        
        <div className="flex gap-3 overflow-x-auto pb-4 hide-scrollbar -mx-4 px-4">
          <div className={`rounded-[2rem] p-5 flex flex-col items-center justify-center min-w-[120px] shadow-sm border transition-all group ${hasStreak ? 'bg-white border-slate-100 hover:border-orange-200 hover:shadow-md hover:shadow-orange-100/50' : 'bg-slate-50 border-slate-200 opacity-50 grayscale'}`}>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 transition-transform duration-300 ${hasStreak ? 'bg-orange-50 text-orange-600 group-hover:scale-110' : 'bg-slate-200 text-slate-400'}`}>
              <Award className="w-7 h-7 stroke-[1.5]" />
            </div>
            <span className="text-xs font-bold text-slate-800 text-center">3+ Trips<br/>Streak</span>
          </div>
          <div className={`rounded-[2rem] p-5 flex flex-col items-center justify-center min-w-[120px] shadow-sm border transition-all group ${hasBulkMaster ? 'bg-white border-slate-100 hover:border-yellow-200 hover:shadow-md hover:shadow-yellow-100/50' : 'bg-slate-50 border-slate-200 opacity-50 grayscale'}`}>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 transition-transform duration-300 ${hasBulkMaster ? 'bg-yellow-50 text-yellow-600 group-hover:scale-110' : 'bg-slate-200 text-slate-400'}`}>
              <TrendingUp className="w-7 h-7 stroke-[1.5]" />
            </div>
            <span className="text-xs font-bold text-slate-800 text-center">Bulk<br/>Master</span>
          </div>
          <div className={`rounded-[2rem] p-5 flex flex-col items-center justify-center min-w-[120px] shadow-sm border transition-all group ${hasFreshSaver ? 'bg-white border-slate-100 hover:border-cyan-200 hover:shadow-md hover:shadow-cyan-100/50' : 'bg-slate-50 border-slate-200 opacity-50 grayscale'}`}>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 transition-transform duration-300 ${hasFreshSaver ? 'bg-cyan-50 text-cyan-600 group-hover:scale-110' : 'bg-slate-200 text-slate-400'}`}>
              <Award className="w-7 h-7 stroke-[1.5]" />
            </div>
            <span className="text-xs font-bold text-slate-800 text-center">First<br/>Savings</span>
          </div>
        </div>
      </div>

      {recentSavings.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4 font-display">Recent Savings</h2>
          <div className="bg-white rounded-[2rem] overflow-hidden shadow-sm border border-slate-100">
            {recentSavings.map((saving, index) => (
              <div key={index} className="flex items-center justify-between p-5 border-b border-slate-50 hover:bg-slate-50/50 transition-colors last:border-b-0">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 stroke-[1.5]" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 block">Shopping Trip</span>
                    <span className="text-xs text-slate-500">{new Date(saving.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                </div>
                <div className="font-black text-emerald-600">
                  +${saving.amount.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-4 font-display">User Preferences</h2>
        
        <div className="bg-white rounded-[2rem] overflow-hidden shadow-sm border border-slate-100 mb-6">
          <div className="flex items-center justify-between p-5 border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
                <Bell className="w-5 h-5 stroke-[1.5]" />
              </div>
              <span className="font-bold text-slate-800">Price Drop Alerts</span>
            </div>
            <div className="w-12 h-6 bg-[#0097b2] rounded-full relative cursor-pointer shadow-inner shadow-black/10">
              <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5 shadow-sm"></div>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-5 border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
                <MapPin className="w-5 h-5 stroke-[1.5]" />
              </div>
              <span className="font-bold text-slate-800">Local Store Tracking</span>
            </div>
            <div className="w-12 h-6 bg-[#0097b2] rounded-full relative cursor-pointer shadow-inner shadow-black/10">
              <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5 shadow-sm"></div>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-5 hover:bg-slate-50/50 transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
                <BarChart2 className="w-5 h-5 stroke-[1.5]" />
              </div>
              <span className="font-bold text-slate-800">Monthly Report</span>
            </div>
            <div className="w-12 h-6 bg-slate-200 rounded-full relative cursor-pointer shadow-inner shadow-black/5">
              <div className="w-5 h-5 bg-white rounded-full absolute left-0.5 top-0.5 shadow-sm"></div>
            </div>
          </div>
        </div>
      </div>

      {showGoalModal && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 relative">
            <button 
              onClick={() => setShowGoalModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-slate-900 mb-2 font-display">Set Monthly Goal</h3>
            <p className="text-slate-500 mb-6 font-medium text-sm">
              How much do you want to save this month?
            </p>
            <div className="flex items-center gap-2 mb-6">
              <span className="text-2xl font-black text-slate-400">$</span>
              <input 
                type="number" 
                value={newGoalValue}
                onChange={(e) => setNewGoalValue(e.target.value)}
                className="w-full text-3xl font-black text-slate-900 border-b-2 border-slate-200 focus:border-[#0097b2] focus:outline-none pb-1 bg-transparent" 
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowGoalModal(false)} 
                className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold py-3 rounded-xl transition-colors border border-slate-200"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveGoal} 
                className="flex-1 bg-[#0097b2] hover:bg-[#007b99] text-white font-bold py-3 rounded-xl transition-colors shadow-sm"
              >
                Save Goal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
