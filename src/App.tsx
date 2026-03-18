import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import UploadFlyer from './pages/UploadFlyer';
import ShoppingList from './pages/ShoppingList';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/upload" element={<UploadFlyer />} />
          <Route path="/list" element={<ShoppingList />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
