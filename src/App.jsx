import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import ContactList from './components/ContactList';
import ImportPage from './components/ImportPage';
import LoginPage from './components/LoginPage';
import Pipeline from './components/Pipeline';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <div className="flex min-h-screen items-center justify-center bg-white text-gray-700">
              <LoginPage />
            </div>
          }
        />
        <Route
          path="/"
          element={
            <div className="flex min-h-screen bg-white pb-16 md:pb-0">
              <main className="min-w-0 flex-1 bg-white">
                <ContactList />
              </main>
            </div>
          }
        />
        <Route
          path="/pipeline"
          element={
            <div className="flex min-h-screen bg-white pb-16 md:pb-0">
              <main className="min-w-0 flex-1 bg-white">
                <Pipeline />
              </main>
            </div>
          }
        />
        <Route
          path="/import"
          element={
            <div className="flex min-h-screen bg-white pb-16 md:pb-0">
              <main className="min-w-0 flex-1 bg-white">
                <ImportPage />
              </main>
            </div>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
