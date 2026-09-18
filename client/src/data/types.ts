export type Chain = {
  id: string;
  slug: string;
  name: string;
  image: string;
  logoFit?: "contain";
  logoClass?: string;
};

export type Gym = {
  id: string;
  slug: string;
  name: string;
  city: string;
  address: string;
  chainId: string;
  lat: number;
  lng: number;
};
