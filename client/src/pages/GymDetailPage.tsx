import { useParams } from "react-router-dom";
import "./PagePlaceholder.css";

function GymDetailPage() {
  const { slug, id } = useParams();
  const label = slug || id || "—";

  return (
    <main className="page">
      <h1>Sali</h1>
      <p>{label}</p>
    </main>
  );
}

export default GymDetailPage;
