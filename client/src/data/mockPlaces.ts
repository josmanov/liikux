export type Place = {
  id: string;
  name: string;
  city: string;
  type: "kuntosali" | "kiipeily";
  image: string;
  logoFit?: "contain";
  logoClass?: string;
};

export const mockPlaces: Place[] = [
  {
    id: "1",
    name: "EasyFit",
    city: "Helsinki",
    type: "kuntosali",
    image: "/brands/easyfit.png",
    logoFit: "contain",
    logoClass: "logo-easyfit",
  },
  {
    id: "2",
    name: "Elixia",
    city: "Helsinki",
    type: "kuntosali",
    image: "/brands/elixia.png",
    logoFit: "contain",
    logoClass: "logo-elixia",
  },
  {
    id: "3",
    name: "Fressi",
    city: "Helsinki",
    type: "kuntosali",
    image: "/brands/fressi.png",
    logoFit: "contain",
    logoClass: "logo-fressi",
  },
  {
    id: "4",
    name: "Fitness24Seven",
    city: "Helsinki",
    type: "kuntosali",
    image: "/brands/fitness24.png?v=2",
    logoFit: "contain",
    logoClass: "logo-fitness24",
  },
  {
    id: "5",
    name: "Go Fitness",
    city: "Helsinki",
    type: "kuntosali",
    image: "/brands/gofitness.png",
    logoFit: "contain",
    logoClass: "logo-gofitness",
  },
  {
    id: "7",
    name: "Liikku",
    city: "Helsinki",
    type: "kuntosali",
    image: "/brands/liikku.png",
    logoFit: "contain",
    logoClass: "logo-liikku",
  },
  {
    id: "8",
    name: "EasyFit",
    city: "Vantaa",
    type: "kuntosali",
    image: "/brands/easyfit.png",
    logoFit: "contain",
    logoClass: "logo-easyfit",
  },
  {
    id: "9",
    name: "Elixia",
    city: "Vantaa",
    type: "kuntosali",
    image: "/brands/elixia.png",
    logoFit: "contain",
    logoClass: "logo-elixia",
  },
  {
    id: "10",
    name: "Fressi",
    city: "Espoo",
    type: "kuntosali",
    image: "/brands/fressi.png",
    logoFit: "contain",
    logoClass: "logo-fressi",
  },
  {
    id: "11",
    name: "Go Fitness",
    city: "Espoo",
    type: "kuntosali",
    image: "/brands/gofitness.png",
    logoFit: "contain",
    logoClass: "logo-gofitness",
  },
];

export function gymsInCity(city: string) {
  return mockPlaces.filter(
    (p) => p.type === "kuntosali" && p.city === city,
  );
}
