import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { supabase } from './supabase';
import LoginPage from './components/LoginPage';
import Sidebar from './components/Sidebar';
import ContactList from './components/ContactList';
import PipelineView from './components/PipelineView';
import ImportPage from './components/ImportPage';

function LoadingScreen() {
  return <div className="flex min-h-screen items-center justify-center bg-white text-gray-700">Loading XIQ...</div>;
}

function ProtectedLayout({ session }) {
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen bg-white pb-16 md:pb-0">
      <Sidebar />
      <main className="min-w-0 flex-1 bg-white">
        <Routes>
          <Route path="/contacts" element={<ContactList />} />
          <Route path="/pipeline" element={<PipelineView />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="*" element={<Navigate to="/contacts" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/contacts" replace /> : <LoginPage />} />
      <Route path="/*" element={<ProtectedLayout session={session} key={location.pathname} />} />
    </Routes>
  );
}
