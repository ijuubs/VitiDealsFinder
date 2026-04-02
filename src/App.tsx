import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import UploadFlyer from './pages/UploadFlyer';
import ShoppingList from './pages/ShoppingList';
import Savings from './pages/Savings';
import Search from './pages/Search';
import FlyerHistory from './pages/FlyerHistory';
import SplashScreen from './components/SplashScreen';
import Onboarding from './components/Onboarding';
import { useAppStore } from './store';

export default function App() {
  const syncOfflineDeals = useAppStore(state => state.syncOfflineDeals);
  const fetchDealsFromSupabase = useAppStore(state => state.fetchDealsFromSupabase);
  const initializeAuth = useAppStore(state => state.initializeAuth);
  const hasCompletedOnboarding = useAppStore(state => state.hasCompletedOnboarding);
  
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    initializeAuth();
    
    const handleOnline = () => {
      console.log('App is back online. Synchronizing offline deals...');
      syncOfflineDeals();
    };

    window.addEventListener('online', handleOnline);
    
    // Also try to sync on initial load if we are online
    if (navigator.onLine) {
      syncOfflineDeals();
      fetchDealsFromSupabase();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [syncOfflineDeals, fetchDealsFromSupabase, initializeAuth]);

  return (
    <BrowserRouter>
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      
      {!showSplash && !hasCompletedOnboarding && <Onboarding />}

      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/upload" element={<UploadFlyer />} />
          <Route path="/list" element={<ShoppingList />} />
          <Route path="/savings" element={<Savings />} />
          <Route path="/history" element={<FlyerHistory />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
