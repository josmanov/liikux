import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "./SponsorSlider.css";

const sponsors = [
  { name: "Elixia", src: "/sponsor-elixia.png?v=2", bg: "#0c2134" },
  { name: "Fressi", src: "/sponsor-fressi.png?v=2", bg: "#f69f00" },
  { name: "EasyFit", src: "/sponsor-easyfit.png?v=2", bg: "#ffe600" },
];

const wait = 4000;

function SponsorSlider() {
  const [i, setI] = useState(0);
  const last = sponsors.length;

  useEffect(() => {
    const t = setTimeout(() => {
      setI((n) => (n + 1) % last);
    }, wait);
    return () => clearTimeout(t);
  }, [i, last]);

  function prev() {
    setI((n) => (n - 1 + last) % last);
  }

  function next() {
    setI((n) => (n + 1) % last);
  }

  return (
    <div className="sponsor-slider">
      {sponsors.map((s, n) => (
        <div
          key={s.name}
          className={n === i ? "sponsor-slide is-on" : "sponsor-slide"}
          style={{ background: s.bg }}
        >
          <img src={s.src} alt="" />
        </div>
      ))}

      <div key={i} className="sponsor-progress">
        <div className="sponsor-progress-bar" />
      </div>

      <button
        type="button"
        className="sponsor-arrow sponsor-arrow-left"
        aria-label="Edellinen"
        onClick={prev}
      >
        <ChevronLeft size={22} />
      </button>
      <button
        type="button"
        className="sponsor-arrow sponsor-arrow-right"
        aria-label="Seuraava"
        onClick={next}
      >
        <ChevronRight size={22} />
      </button>

      <div className="sponsor-dots">
        {sponsors.map((s, n) => (
          <button
            key={s.name}
            type="button"
            className={n === i ? "sponsor-dot is-on" : "sponsor-dot"}
            aria-label={s.name}
            onClick={() => setI(n)}
          />
        ))}
      </div>
    </div>
  );
}

export default SponsorSlider;
