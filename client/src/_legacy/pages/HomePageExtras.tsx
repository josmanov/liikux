import { useState } from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Bike,
  Dumbbell,
  Footprints,
  Goal,
  Mountain,
  PersonStanding,
  Target,
  Trophy,
  Waves,
} from "lucide-react";
import HoverIcon, { usePickHover } from "../../components/HoverIcon";
import { lajiGifUrl } from "../../data/lajiGifs";
import { useLang } from "../../i18n/useLang";

export const picks = [
  {
    name: "Kuntosalit",
    to: "/fi/kuntosalit",
    icon: "/picks/kuntosalit.gif",
    still: "/picks/kuntosalit-still.png",
    animated: true,
  },
  {
    name: "Harrastukset",
    to: "/harjoitukset",
    icon: "/picks/harrastukset.gif",
    still: "/picks/harrastukset-still.png",
    animated: true,
  },
];

export const lajit: {
  name: string;
  to: string;
  Icon?: LucideIcon;
}[] = [
  { name: "Kuntosali", to: "/fi/kuntosalit", Icon: Dumbbell },
  { name: "Jalkapallo", to: "/harjoitukset/", Icon: Goal },
  { name: "Juoksu", to: "/harjoitukset", Icon: Footprints },
  { name: "Pyöräily", to: "/harjoitukset", Icon: Bike },
  { name: "Uinti", to: "/harjoitukset", Icon: Waves },
  { name: "Tanssi", to: "/harjoitukset", Icon: PersonStanding },
  { name: "Kiipeily", to: "/harjoitukset", Icon: Mountain },
  { name: "Koripallo", to: "/harjoitukset", Icon: Trophy },
  { name: "Tennis", to: "/harjoitukset", Icon: Target },
  { name: "Padeli", to: "/harjoitukset", Icon: Trophy },
];

export function LajiIcon({ name, Icon }: { name: string; Icon?: LucideIcon }) {
  const gif = lajiGifUrl(name);
  const [broken, setBroken] = useState(false);

  if (gif && !broken) {
    return (
      <img
        className="laji-gif"
        src={gif}
        alt=""
        onError={() => setBroken(true)}
      />
    );
  }

  if (Icon) {
    return <Icon className="laji-icon" strokeWidth={2} />;
  }
  return null;
}

export function SearchButton() {
  const { t } = useLang();
  return (
    <button type="button" className="hero-locate" aria-label={t("search")}>
      <img src="/picks/search.png" alt="" width={22} height={22} />
    </button>
  );
}

export function PickLink({
  pick,
}: {
  pick: {
    name: string;
    to: string;
    icon: string;
    still?: string;
    animated?: boolean;
  };
}) {
  const hover = usePickHover();

  return (
    <Link
      to={pick.to}
      className="hero-pick"
      onMouseEnter={pick.animated ? hover.onMouseEnter : undefined}
      onMouseLeave={pick.animated ? hover.onMouseLeave : undefined}
    >
      <HoverIcon
        src={pick.icon}
        stillSrc={pick.still}
        animated={pick.animated}
        playing={hover.playing}
        playKey={hover.playKey}
      />
      <span>{pick.name}</span>
    </Link>
  );
}
