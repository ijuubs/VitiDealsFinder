import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Upload, ShoppingCart } from 'lucide-react';
import { useAppStore } from '../store';

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const shoppingList = useAppStore(state => state.shoppingList);
  const itemCount = shoppingList.reduce((acc, item) => acc + item.quantity, 0);

  const navItems = [
    { path: '/', label: 'Deals', icon: Home },
    { path: '/upload', label: 'Upload Flyer', icon: Upload },
    { path: '/list', label: 'Shopping List', icon: ShoppingCart, badge: itemCount },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl leading-none">F</span>
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-800">Fiji Smart Deals</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                  location.pathname === item.path ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="bg-emerald-100 text-emerald-700 py-0.5 px-2 rounded-full text-xs font-bold">
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 pb-24 md:pb-8">
        {children}
      </main>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-center h-16 pb-safe z-10">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center justify-center w-full h-full gap-1 ${
              location.pathname === item.path ? 'text-emerald-600' : 'text-slate-500'
            }`}
          >
            <div className="relative">
              <item.icon className="w-5 h-5" />
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute -top-2 -right-2 bg-emerald-500 text-white w-4 h-4 flex items-center justify-center rounded-full text-[10px] font-bold">
                  {item.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
