import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import NavBar from './components/NavBar';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Builder from './pages/Builder';
import Methodology from './pages/Methodology';
import DevNotes from './pages/DevNotes';

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <div className="nx-app">
      <ScrollTop />
      <NavBar />
      <main className="nx-main">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/builder" element={<Builder />} />
          <Route path="/methodology" element={<Methodology />} />
          <Route path="/developers" element={<DevNotes />} />
          <Route path="*" element={<Landing />} />
        </Routes>
      </main>
    </div>
  );
}
