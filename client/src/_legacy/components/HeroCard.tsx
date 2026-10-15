import { useEffect, useState } from "react";
import "./uiverse-card.css";
import "./HeroCard.css";

const slides = ["/hero-gym.jpg", "/hero-swim.jpg", "/hero-climb.png"];

function HeroCard() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setI((n) => (n + 1) % slides.length);
    }, 4000);
    return () => clearTimeout(t);
  }, [i]);

  return (
    <div className="card hero-card">
      {slides.map((src, n) => (
        <img
          key={src}
          className={n === i ? "hero-card-img is-on" : "hero-card-img"}
          src={src}
          alt=""
        />
      ))}
      <div className="hero-card-bar">
        <div key={i} className="hero-card-bar-fill"></div>
      </div>
    </div>
  );
}

export default HeroCard;
