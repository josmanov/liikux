const FILE_TO_LAJI: Record<string, string> = {
  "weight-lifting": "Kuntosali",
  weightlifting: "Kuntosali",
  gym: "Kuntosali",
  kuntosali: "Kuntosali",
  football: "Jalkapallo",
  soccer: "Jalkapallo",
  jalkapallo: "Jalkapallo",
  running: "Juoksu",
  run: "Juoksu",
  juoksu: "Juoksu",
  cycling: "Pyöräily",
  bike: "Pyöräily",
  bicycle: "Pyöräily",
  pyoraily: "Pyöräily",
  swimmer: "Uinti",
  swim: "Uinti",
  swimming: "Uinti",
  uinti: "Uinti",
  yoga: "Jooga",
  jooga: "Jooga",
  climbing: "Kiipeily",
  climb: "Kiipeily",
  kiipeily: "Kiipeily",
  basketball: "Koripallo",
  koripallo: "Koripallo",
  "tennis-racket": "Tennis",
  tennis: "Tennis",
  padel: "Padeli",
  padeli: "Padeli",
  crossfit: "Crossfit",
  martial: "Kamppailu",
  fighting: "Kamppailu",
  kamppailu: "Kamppailu",
  dance: "Tanssi",
  dancing: "Tanssi",
  tanssi: "Tanssi",
  volleyball: "Lentopallo",
  lentopallo: "Lentopallo",
  badminton: "Sulkapallo",
  sulkapallo: "Sulkapallo",
  ski: "Hiihto",
  skiing: "Hiihto",
  hiihto: "Hiihto",
  golf: "Golf",
  kayak: "Melonta",
  canoe: "Melonta",
  melonta: "Melonta",
  floorball: "Salibandy",
  salibandy: "Salibandy",
  frisbee: "Frisbeegolf",
  "frisbee-golf": "Frisbeegolf",
  frisbeegolf: "Frisbeegolf",
};

const gifByLaji: Record<string, string> = {};

for (const [file, laji] of Object.entries(FILE_TO_LAJI)) {
  if (!gifByLaji[laji]) {
    gifByLaji[laji] = `/lajit/${file}.gif`;
  }
}

export function lajiGifUrl(name: string): string | undefined {
  return gifByLaji[name];
}
