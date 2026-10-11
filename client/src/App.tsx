import { lazy, Suspense, useCallback, useRef, useState } from "react";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import HomePage from "./pages/HomePage";
import LegalPage from "./pages/LegalPage";
import ComingSoonPage from "./pages/ComingSoonPage";
import NotFoundPage from "./pages/NotFoundPage";
import { getReleaseAtMs, shouldShowComingSoon } from "./releaseGate";

const GymsPage = lazy(() => import("./pages/GymsPage"));
const GymDetailPage = lazy(() => import("./pages/GymDetailPage"));
const AdminDataPage = lazy(() => import("./pages/AdminDataPage"));

function RouteFallback() {
  return <div className="route-fallback" aria-hidden="true" />;
}

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
          <Route
            path="/fi/kuntosalit"
            element={
              <Suspense fallback={<RouteFallback />}>
                <GymsPage />
              </Suspense>
            }
          />
          <Route
            path="/fi/kuntosalit/:regionSlug"
            element={
              <Suspense fallback={<RouteFallback />}>
                <GymsPage />
              </Suspense>
            }
          />
          <Route
            path="/fi/kuntosalit/:regionSlug/:citySlug"
            element={
              <Suspense fallback={<RouteFallback />}>
                <GymsPage />
              </Suspense>
            }
          />
          <Route
            path="/en/gyms"
            element={
              <Suspense fallback={<RouteFallback />}>
                <GymsPage />
              </Suspense>
            }
          />
          <Route
            path="/en/gyms/:regionSlug"
            element={
              <Suspense fallback={<RouteFallback />}>
                <GymsPage />
              </Suspense>
            }
          />
          <Route
            path="/en/gyms/:regionSlug/:citySlug"
            element={
              <Suspense fallback={<RouteFallback />}>
                <GymsPage />
              </Suspense>
            }
          />
          <Route
            path="/fi/ketju/:slug"
            element={
              <Suspense fallback={<RouteFallback />}>
                <GymsPage />
              </Suspense>
            }
          />
          <Route
            path="/en/chain/:slug"
            element={
              <Suspense fallback={<RouteFallback />}>
                <GymsPage />
              </Suspense>
            }
          />
          <Route
            path="/fi/sali/:slug"
            element={
              <Suspense fallback={<RouteFallback />}>
                <GymDetailPage />
              </Suspense>
            }
          />
          <Route
            path="/en/gym/:slug"
            element={
              <Suspense fallback={<RouteFallback />}>
                <GymDetailPage />
              </Suspense>
            }
          />
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
          <Route
            path="/admin/data"
            element={
              <Suspense fallback={<RouteFallback />}>
                <AdminDataPage />
              </Suspense>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
