import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import GymsPage from "./pages/GymsPage";
import GymDetailPage from "./pages/GymDetailPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import FavoritesPage from "./pages/FavoritesPage";
import AboutPage from "./pages/AboutPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/gyms" element={<GymsPage />} />
        <Route path="/gyms/:id" element={<GymDetailPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/about" element={<AboutPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
