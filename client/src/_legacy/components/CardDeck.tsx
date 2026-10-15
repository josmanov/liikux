import { useMemo } from "react";
import "./CardDeck.css";

interface DeckCard {
  color: string;
  icon: string;
}

const cards: DeckCard[] = [
  { color: "#c8722e", icon: "🧘" },
  { color: "#2f6b4f", icon: "⛰️" },
  { color: "#2f7ea3", icon: "🏊" },
  { color: "#8a3d2f", icon: "🥊" },
  { color: "#6b5638", icon: "🏃" },
  { color: "#d19a3d", icon: "🧘" },
  { color: "#3f8a5a", icon: "⛰️" },
];

const DECK_WIDTH = 640;
const CARD_WIDTH = 76;

export default function CardDeck() {
  const positions = useMemo(() => {
    const gap = (DECK_WIDTH - CARD_WIDTH) / (cards.length - 1);
    const startX = (DECK_WIDTH - (CARD_WIDTH + gap * (cards.length - 1))) / 2;
    return cards.map((_, i) => startX + i * gap);
  }, []);

  return (
    <div className="deck">
      {cards.map((card, i) => (
        <div
          key={i}
          className="fan-card"
          style={{ left: positions[i], background: card.color, zIndex: i }}
        >
          <span className="icon">{card.icon}</span>
        </div>
      ))}
    </div>
  );
}
