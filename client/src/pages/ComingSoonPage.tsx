import { useEffect, useState } from "react";
import "./ComingSoonPage.css";

type Parts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
};

function splitMs(ms: number): Parts {
  if (ms <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
  }
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return { days, hours, minutes, seconds, done: false };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

type Props = {
  releaseAt: number;
  onUnlock: () => void;
};

function ComingSoonPage({ releaseAt, onUnlock }: Props) {
  const [parts, setParts] = useState(() =>
    splitMs(releaseAt - Date.now()),
  );

  useEffect(() => {
    function tick() {
      const next = splitMs(releaseAt - Date.now());
      setParts(next);
      if (next.done) onUnlock();
    }
    tick();
    const id = window.setInterval(tick, 250);
    return () => clearInterval(id);
  }, [releaseAt, onUnlock]);

  return (
    <main className="coming-soon">
      <div className="coming-soon-bg" aria-hidden="true" />
      <div className="coming-soon-inner">
        <img
          className="coming-soon-logo"
          src="/liikux-logo-light.png?v=white"
          alt="Liikux"
        />
        <p className="coming-soon-eyebrow">Tulossa pian</p>
        <h1 className="coming-soon-title">Etsi sali. Nosta rajojasi.</h1>
        <p className="coming-soon-text">
          Suomen kuntosalihakemisto avautuu pian. Pysy linjoilla.
        </p>

        <div className="coming-soon-clock" aria-live="polite">
          <div className="coming-soon-unit">
            <strong>{pad(parts.days)}</strong>
            <span>pv</span>
          </div>
          <div className="coming-soon-unit">
            <strong>{pad(parts.hours)}</strong>
            <span>h</span>
          </div>
          <div className="coming-soon-unit">
            <strong>{pad(parts.minutes)}</strong>
            <span>min</span>
          </div>
          <div className="coming-soon-unit">
            <strong>{pad(parts.seconds)}</strong>
            <span>s</span>
          </div>
        </div>
      </div>
    </main>
  );
}

export default ComingSoonPage;
