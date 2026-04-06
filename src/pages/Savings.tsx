import React, { useMemo, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Award, TrendingUp, History, Bell, MapPin, BarChart2, Edit2, X, CheckCircle2, LogOut, LogIn, PieChart as PieChartIcon } from 'lucide-react';
import { useAppStore } from '../store';
import AuthModal from '../components/AuthModal';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function Savings() {
  const savingsHistory = useAppStore(state => state.savingsHistory);
  const monthlyGoal = useAppStore(state => state.monthlyGoal);
  const setMonthlyGoal = useAppStore(state => state.setMonthlyGoal);
  const user = useAppStore(state => state.user);
  const isAdmin = useAppStore(state => state.isAdmin);
  const signOut = useAppStore(state => state.signOut);
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const element = document.getElementById(location.hash.replace('#', ''));
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  }, [location]);

  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
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
    <div className="pb-6 space-y-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-black text-slate-900 font-display tracking-tight">
            {user ? `Bula, ${user.email?.split('@')[0]}!` : 'Bula!'}
          </h1>
          <p className="text-slate-500 mt-1 font-medium">Your digital curator is tracking your savings.</p>
        </div>
        {user ? (
          <button 
            onClick={() => signOut()}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-200 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        ) : (
          <button 
            onClick={() => setShowAuthModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-sm font-bold hover:bg-emerald-100 transition-colors"
          >
            <LogIn className="w-4 h-4" />
            Sign In
          </button>
        )}
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

      {/* Personalized Savings Goals */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-4 font-display">Personalized Goals</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-slate-800">Christmas Dinner</h3>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">Target: $200</span>
            </div>
            <div className="flex justify-between text-sm font-medium text-slate-500 mb-2">
              <span>Saved: $120.50</span>
              <span>60%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: '60%' }}></div>
            </div>
          </div>
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-slate-800">New School Supplies</h3>
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">Target: $150</span>
            </div>
            <div className="flex justify-between text-sm font-medium text-slate-500 mb-2">
              <span>Saved: $45.00</span>
              <span>30%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: '30%' }}></div>
            </div>
          </div>
        </div>
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

      {/* Trend-Driven Insights Dashboard */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-4 font-display">Trend-Driven Insights</h2>
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 mb-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-6 h-6 stroke-[1.5]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">AI Stock-Up Advice</h3>
              <p className="text-slate-500 text-sm mt-1">Based on current market lows and your past purchases.</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="bg-orange-50/50 rounded-2xl p-4 border border-orange-100/50">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-slate-900">Pantry Staples</h4>
                <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded-lg">Market Low</span>
              </div>
              <p className="text-sm text-slate-600">
                Rice and Flour prices are currently <strong className="text-emerald-600">15% lower</strong> than the 90-day average. Consider stocking up for the next 2 months.
              </p>
            </div>
            
            <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100/50">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-slate-900">Dairy Products</h4>
                <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded-lg">Hold Off</span>
              </div>
              <p className="text-sm text-slate-600">
                Butter and Cheese prices are peaking. Wait for the upcoming weekend sales at Extra Supermarket.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Dashboard */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-4 font-display">Savings Analytics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-cyan-600" />
              Spending by Category
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Produce', value: 400 },
                      { name: 'Meat', value: 300 },
                      { name: 'Pantry', value: 300 },
                      { name: 'Dairy', value: 200 },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {[
                      { name: 'Produce', value: 400 },
                      { name: 'Meat', value: 300 },
                      { name: 'Pantry', value: 300 },
                      { name: 'Dairy', value: 200 },
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#0097b2', '#10b981', '#f59e0b', '#3b82f6'][index % 4]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `$${value}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-2 text-xs font-medium text-slate-600">
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-[#0097b2]"></div>Produce</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-emerald-500"></div>Meat</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-amber-500"></div>Pantry</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-blue-500"></div>Dairy</div>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-emerald-600" />
              Savings by Supermarket
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: 'RB Patel', savings: 120 },
                    { name: 'New World', savings: 85 },
                    { name: 'MaxVal-u', savings: 65 },
                    { name: 'Extra', savings: 45 },
                  ]}
                  margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                >
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(value) => `$${value}`} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} formatter={(value) => [`$${value}`, 'Savings']} />
                  <Bar dataKey="savings" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Smart Watchlist Section */}
      <div id="smart-watchlist">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-2xl font-bold text-slate-900 font-display">Smart Watchlist</h2>
        </div>
        
        <div className="bg-white rounded-[2rem] overflow-hidden shadow-sm border border-slate-100 mb-6">
          {useAppStore(state => state.priceAlerts).length > 0 ? (
            useAppStore(state => state.priceAlerts).map((alert, index) => {
              const deal = useAppStore(state => state.deals).find(d => d.product_id === alert.productId);
              if (!deal) return null;
              return (
                <div key={index} className="flex items-center justify-between p-5 border-b border-slate-50 hover:bg-slate-50/50 transition-colors last:border-b-0">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {deal.image_url ? (
                        <img src={deal.image_url} alt={deal.name} className="w-full h-full object-cover mix-blend-multiply" />
                      ) : (
                        <Bell className="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 block line-clamp-1">{deal.name}</span>
                      <span className="text-xs text-slate-500">Target: ${alert.targetPrice.toFixed(2)}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => useAppStore.getState().removePriceAlert(alert.productId)}
                    className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <Bell className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-500 font-medium">Your watchlist is empty.</p>
              <p className="text-sm text-slate-400 mt-1">Set price alerts on products to track them here.</p>
              <Link to="/search" className="inline-block mt-4 px-4 py-2 bg-cyan-50 text-cyan-700 font-bold rounded-xl text-sm hover:bg-cyan-100 transition-colors">
                Browse Deals
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Leaderboard */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-4 font-display">Top Savers in Viti Levu</h2>
        <div className="bg-white rounded-[2rem] overflow-hidden shadow-sm border border-slate-100">
          {[
            { name: 'Sereima T.', savings: 342.50, isUser: false },
            { name: 'Jone V.', savings: 285.00, isUser: false },
            { name: 'You', savings: totalSavingsThisMonth, isUser: true },
            { name: 'Priya S.', savings: 150.20, isUser: false },
            { name: 'Tomasi R.', savings: 95.00, isUser: false },
          ].sort((a, b) => b.savings - a.savings).map((saver, index) => (
            <div key={index} className={`flex items-center justify-between p-5 border-b border-slate-50 transition-colors last:border-b-0 ${saver.isUser ? 'bg-emerald-50/50' : 'hover:bg-slate-50/50'}`}>
              <div className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${index === 0 ? 'bg-amber-100 text-amber-600' : index === 1 ? 'bg-slate-200 text-slate-600' : index === 2 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'}`}>
                  {index + 1}
                </div>
                <span className={`font-bold ${saver.isUser ? 'text-emerald-700' : 'text-slate-800'}`}>{saver.name}</span>
              </div>
              <div className={`font-black ${saver.isUser ? 'text-emerald-600' : 'text-slate-600'}`}>
                ${saver.savings.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </div>

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

        {isAdmin && (
          <>
            <h2 className="text-2xl font-bold text-slate-900 mb-4 font-display mt-8">Data & History</h2>
            <div className="bg-white rounded-[2rem] overflow-hidden shadow-sm border border-slate-100 mb-6">
              <Link to="/history" className="flex items-center justify-between p-5 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <History className="w-5 h-5 stroke-[1.5]" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 block">Flyer History</span>
                    <span className="text-xs text-slate-500">View previously uploaded flyers</span>
                  </div>
                </div>
                <div className="text-slate-400">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </div>
              </Link>
            </div>
          </>
        )}
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

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
