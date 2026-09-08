import { useState } from "react";

type Props = {
  src: string;
  stillSrc?: string;
  animated?: boolean;
  playing?: boolean;
  playKey?: number;
  alt?: string;
};

function HoverIcon({
  src,
  stillSrc,
  animated = false,
  playing = false,
  playKey = 0,
  alt = "",
}: Props) {
  if (!animated) {
    return <img className="hero-pick-icon" src={src} alt={alt} />;
  }

  return (
    <span className="hero-pick-gif">
      <img
        className="hero-pick-gif-still"
        src={stillSrc || src}
        alt={alt}
        style={{ opacity: playing ? 0 : 1 }}
      />
      {playing ? (
        <img
          key={playKey}
          className="hero-pick-gif-anim"
          src={`${src}?r=${playKey}`}
          alt=""
          aria-hidden="true"
          style={{ opacity: 1 }}
        />
      ) : null}
    </span>
  );
}

export default HoverIcon;

export function usePickHover() {
  const [playing, setPlaying] = useState(false);
  const [playKey, setPlayKey] = useState(0);

  return {
    playing,
    playKey,
    onMouseEnter: () => {
      setPlayKey((n) => n + 1);
      setPlaying(true);
    },
    onMouseLeave: () => setPlaying(false),
  };
}
