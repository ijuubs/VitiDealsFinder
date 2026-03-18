import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import UploadFlyer from './pages/UploadFlyer';
import ShoppingList from './pages/ShoppingList';
import ChatConcierge from './components/ChatConcierge';
import { useAppStore } from './store';

export default function App() {
  const syncOfflineDeals = useAppStore(state => state.syncOfflineDeals);

  useEffect(() => {
    const handleOnline = () => {
      console.log('App is back online. Synchronizing offline deals...');
      syncOfflineDeals();
    };

    window.addEventListener('online', handleOnline);
    
    // Also try to sync on initial load if we are online
    if (navigator.onLine) {
      syncOfflineDeals();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [syncOfflineDeals]);

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/upload" element={<UploadFlyer />} />
          <Route path="/list" element={<ShoppingList />} />
        </Routes>
      </Layout>
      <ChatConcierge />
    </BrowserRouter>
  );
}
