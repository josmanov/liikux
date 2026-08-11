import { useParams } from "react-router-dom";
import "./PagePlaceholder.css";

function GymDetailPage() {
  const { id } = useParams();

  return (
    <main className="page">
      <h1>Sali</h1>
      <p>id: {id}</p>
    </main>
  );
}

export default GymDetailPage;
