import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Upload, ShoppingCart, WifiOff, MapPin, Search, Bell, Activity, Eye, Award, BarChart2, User } from 'lucide-react';
import { useAppStore } from '../store';
import CompareBar from './CompareBar';

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const shoppingList = useAppStore(state => state.shoppingList);
  const selectedRegion = useAppStore(state => state.selectedRegion);
  const setSelectedRegion = useAppStore(state => state.setSelectedRegion);
  const itemCount = shoppingList.reduce((acc, item) => acc + item.quantity, 0);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/search', label: 'Search', icon: Search },
    { path: '/list', label: 'Optimizer', icon: Activity, badge: itemCount },
    { path: '/savings', label: 'Profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-24">
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-slate-100/50">
        {isOffline && (
          <div className="bg-amber-100 text-amber-800 px-4 py-2 text-sm font-medium flex items-center justify-center gap-2">
            <WifiOff className="w-4 h-4" />
            You are currently offline. Viewing cached data.
          </div>
        )}
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#0097b2]">
            <div className="w-8 h-8 bg-cyan-50 rounded-full flex items-center justify-center">
              <MapPin className="w-4 h-4 fill-current" />
            </div>
            <select 
              value={selectedRegion} 
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="font-bold text-xl tracking-tight font-display bg-transparent border-none focus:ring-0 cursor-pointer appearance-none outline-none"
            >
              <option value="current">Current Location</option>
              <option value="suva">Suva</option>
              <option value="nadi">Nadi</option>
              <option value="lautoka">Lautoka</option>
              <option value="labasa">Labasa</option>
              <option value="nausori">Nausori</option>
              <option value="ba">Ba</option>
              <option value="sigatoka">Sigatoka</option>
              <option value="savusavu">Savusavu</option>
              <option value="rakiraki">Rakiraki</option>
              <option value="tavua">Tavua</option>
              <option value="navua">Navua</option>
              <option value="all">All Fiji</option>
            </select>
          </div>
          
          <div className="flex items-center gap-3">
            <button className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors">
              <Search className="w-5 h-5" />
            </button>
            <button className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-slate-50"></span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6">
        {children}
      </main>

      <CompareBar />

      {/* Mobile Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-safe pt-2 bg-gradient-to-t from-white via-white to-transparent pointer-events-none">
        <div className="max-w-md mx-auto bg-white/90 backdrop-blur-xl border border-slate-200/50 shadow-[0_8px_32px_rgba(0,0,0,0.08)] rounded-3xl flex justify-around items-center h-16 mb-4 px-2 pointer-events-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center w-full h-full gap-1 relative ${
                  isActive ? 'text-[#0097b2]' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {isActive && (
                  <div className="absolute -top-3 w-12 h-1 bg-[#0097b2] rounded-b-full"></div>
                )}
                <div className={`relative flex items-center justify-center w-10 h-10 rounded-2xl transition-all duration-300 ${isActive ? 'bg-cyan-50 scale-110' : ''}`}>
                  <item.icon className={`w-5 h-5 transition-all duration-300 ${isActive ? 'fill-current stroke-[1.5]' : 'stroke-2'}`} />
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white w-4 h-4 flex items-center justify-center rounded-full text-[10px] font-bold border-2 border-white shadow-sm">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] uppercase tracking-wider transition-all duration-300 ${isActive ? 'font-bold opacity-100' : 'font-semibold opacity-70'}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
