import { lazy, Suspense, useCallback, useRef, useState } from "react";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import HomePage from "./pages/HomePage";
import LegalPage from "./pages/LegalPage";
import ComingSoonPage from "./pages/ComingSoonPage";
import MaintenancePage from "./pages/MaintenancePage";
import NotFoundPage from "./pages/NotFoundPage";
import {
  getReleaseAtMs,
  shouldShowComingSoon,
  shouldShowMaintenance,
} from "./releaseGate";

const GymsPage = lazy(() => import("./pages/GymsPage"));
const GymDetailPage = lazy(() => import("./pages/GymDetailPage"));
const AdminDataPage = lazy(() => import("./pages/AdminDataPage"));
const AdminReviewPage = lazy(() => import("./pages/AdminReviewPage"));
const CitiesPage = lazy(() => import("./pages/CitiesPage"));
const FeedbackPage = lazy(() => import("./pages/FeedbackPage"));
const ChainsPage = lazy(() => import("./pages/ChainsPage"));
const FavoritesPage = lazy(() => import("./pages/FavoritesPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const BusinessPage = lazy(() => import("./pages/BusinessPage"));

function RouteFallback() {
  return <div className="route-fallback" aria-hidden="true" />;
}

function App() {
  const [maintenance] = useState(() => shouldShowMaintenance());
  const [locked] = useState(() => shouldShowComingSoon());
  const releaseAt = getReleaseAtMs();
  const unlocking = useRef(false);

  const unlock = useCallback(() => {
    if (unlocking.current) return;
    unlocking.current = true;
    window.location.reload();
  }, []);

  if (maintenance) {
    return <MaintenancePage />;
  }

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
          <Route
            path="/fi/ketjut"
            element={
              <Suspense fallback={<RouteFallback />}>
                <ChainsPage />
              </Suspense>
            }
          />
          <Route
            path="/en/chains"
            element={
              <Suspense fallback={<RouteFallback />}>
                <ChainsPage />
              </Suspense>
            }
          />
          <Route
            path="/fi/suosikit"
            element={
              <Suspense fallback={<RouteFallback />}>
                <FavoritesPage />
              </Suspense>
            }
          />
          <Route
            path="/en/favorites"
            element={
              <Suspense fallback={<RouteFallback />}>
                <FavoritesPage />
              </Suspense>
            }
          />
          <Route
            path="/fi/palaute"
            element={
              <Suspense fallback={<RouteFallback />}>
                <FeedbackPage />
              </Suspense>
            }
          />
          <Route
            path="/en/feedback"
            element={
              <Suspense fallback={<RouteFallback />}>
                <FeedbackPage />
              </Suspense>
            }
          />
          <Route
            path="/fi/kaupungit"
            element={
              <Suspense fallback={<RouteFallback />}>
                <CitiesPage />
              </Suspense>
            }
          />
          <Route
            path="/en/cities"
            element={
              <Suspense fallback={<RouteFallback />}>
                <CitiesPage />
              </Suspense>
            }
          />
          <Route
            path="/fi/tietoa"
            element={
              <Suspense fallback={<RouteFallback />}>
                <AboutPage />
              </Suspense>
            }
          />
          <Route
            path="/en/about"
            element={
              <Suspense fallback={<RouteFallback />}>
                <AboutPage />
              </Suspense>
            }
          />
          <Route
            path="/fi/yrityksille"
            element={
              <Suspense fallback={<RouteFallback />}>
                <BusinessPage />
              </Suspense>
            }
          />
          <Route
            path="/en/for-gyms"
            element={
              <Suspense fallback={<RouteFallback />}>
                <BusinessPage />
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
          <Route path="/favorites" element={<Navigate to="/fi/suosikit" replace />} />
          <Route path="/about" element={<Navigate to="/fi/tietoa" replace />} />
          <Route
            path="/admin/tarkistus"
            element={
              <Suspense fallback={<RouteFallback />}>
                <AdminReviewPage />
              </Suspense>
            }
          />
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
