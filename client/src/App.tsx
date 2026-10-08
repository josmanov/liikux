import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import HomePage from "./pages/HomePage";
import GymsPage from "./pages/GymsPage";
import GymDetailPage from "./pages/GymDetailPage";
import NotFoundPage from "./pages/NotFoundPage";
import AdminDataPage from "./pages/AdminDataPage";

function App() {
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
