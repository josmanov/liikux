import "dotenv/config";
import { db } from "../db/index.js";
import { chains, gyms } from "../db/schema.js";

const chainRows = [
  {
    id: "c1",
    slug: "easyfit",
    name: "EasyFit",
    image: "/brands/easyfit.png",
    logoFit: "contain",
    logoClass: "logo-easyfit",
  },
  {
    id: "c2",
    slug: "elixia",
    name: "Elixia",
    image: "/brands/elixia.png",
    logoFit: "contain",
    logoClass: "logo-elixia",
  },
  {
    id: "c3",
    slug: "fressi",
    name: "Fressi",
    image: "/brands/fressi.png",
    logoFit: "contain",
    logoClass: "logo-fressi",
  },
  {
    id: "c4",
    slug: "fitness24seven",
    name: "Fitness24Seven",
    image: "/brands/fitness24.png?v=2",
    logoFit: "contain",
    logoClass: "logo-fitness24",
  },
  {
    id: "c5",
    slug: "go-fitness",
    name: "Go Fitness",
    image: "/brands/gofitness.png",
    logoFit: "contain",
    logoClass: "logo-gofitness",
  },
  {
    id: "c6",
    slug: "liikku",
    name: "Liikku",
    image: "/brands/liikku.png",
    logoFit: "contain",
    logoClass: "logo-liikku",
  },
];

const gymRows = [
  {
    id: "g1",
    slug: "elixia-redi",
    name: "Elixia Redi",
    city: "Helsinki",
    address: "Hermannin rantatie 5, Helsinki",
    chainId: "c2",
  },
  {
    id: "g2",
    slug: "elixia-itis",
    name: "Elixia Itis",
    city: "Helsinki",
    address: "Itäkatu 1-7, Helsinki",
    chainId: "c2",
  },
  {
    id: "g3",
    slug: "easyfit-kamppi",
    name: "EasyFit Kamppi",
    city: "Helsinki",
    address: "Urho Kekkosen katu 1, Helsinki",
    chainId: "c1",
  },
  {
    id: "g4",
    slug: "easyfit-tikkurila",
    name: "EasyFit Tikkurila",
    city: "Vantaa",
    address: "Ratatie 11, Vantaa",
    chainId: "c1",
  },
  {
    id: "g5",
    slug: "fressi-tapiola",
    name: "Fressi Tapiola",
    city: "Espoo",
    address: "Länsituuli 7, Espoo",
    chainId: "c3",
  },
  {
    id: "g6",
    slug: "liikku-pasila",
    name: "Liikku Pasila",
    city: "Helsinki",
    address: "Pasilankatu 2, Helsinki",
    chainId: "c6",
  },
];

async function seed() {
  await db.insert(chains).values(chainRows).onConflictDoNothing();
  await db.insert(gyms).values(gymRows).onConflictDoNothing();
  console.log("Seed OK");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});