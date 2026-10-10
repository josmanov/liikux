import { useCallback, useRef, useState } from "react";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import HomePage from "./pages/HomePage";
import GymsPage from "./pages/GymsPage";
import GymDetailPage from "./pages/GymDetailPage";
import LegalPage from "./pages/LegalPage";
import ComingSoonPage from "./pages/ComingSoonPage";
import NotFoundPage from "./pages/NotFoundPage";
import AdminDataPage from "./pages/AdminDataPage";
import { getReleaseAtMs, shouldShowComingSoon } from "./releaseGate";

function App() {
  const [locked] = useState(() => shouldShowComingSoon());
  const releaseAt = getReleaseAtMs();
  const unlocking = useRef(false);

  const unlock = useCallback(() => {
    if (unlocking.current) return;
    unlocking.current = true;
    window.location.reload();
  }, []);

  if (locked && releaseAt != null) {
    return <ComingSoonPage releaseAt={releaseAt} onUnlock={unlock} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/en" element={<HomePage />} />
          <Route path="/fi/kuntosalit" element={<GymsPage />} />
          <Route path="/en/gyms" element={<GymsPage />} />
          <Route path="/fi/ketju/:slug" element={<GymsPage />} />
          <Route path="/en/chain/:slug" element={<GymsPage />} />
          <Route path="/fi/sali/:slug" element={<GymDetailPage />} />
          <Route path="/en/gym/:slug" element={<GymDetailPage />} />
          <Route path="/fi/kayttoehdot" element={<LegalPage />} />
          <Route path="/fi/tietosuoja" element={<LegalPage />} />
          <Route path="/fi/evasteet" element={<LegalPage />} />
          <Route path="/en/terms" element={<LegalPage />} />
          <Route path="/en/privacy" element={<LegalPage />} />
          <Route path="/en/cookies" element={<LegalPage />} />
          <Route path="/hobbies" element={<Navigate to="/" replace />} />
          <Route path="/harjoitukset" element={<Navigate to="/" replace />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/register" element={<Navigate to="/" replace />} />
          <Route path="/favorites" element={<Navigate to="/" replace />} />
          <Route path="/about" element={<Navigate to="/" replace />} />
          <Route path="/admin/data" element={<AdminDataPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
