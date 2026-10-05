import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import HomePage from "./pages/HomePage";
import GymsPage from "./pages/GymsPage";
import GymDetailPage from "./pages/GymDetailPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import FavoritesPage from "./pages/FavoritesPage";
import AboutPage from "./pages/AboutPage";
import HobbysPage from "./pages/HobbysPage";
import AdminDataPage from "./pages/AdminDataPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/fi/kuntosalit" element={<GymsPage />} />
          <Route path="/hobbies" element={<HobbysPage />} />
          <Route path="/fi/ketju/:slug" element={<GymsPage />} />
          <Route path="/fi/sali/:slug" element={<GymDetailPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/admin/data" element={<AdminDataPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
