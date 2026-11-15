// Builds the Liikux map style: client/public/map/liikux-style.json
//
// How it works:
//   1. Download OpenFreeMap's free "positron" vector style (same tiles, no API key,
//      commercial use allowed: https://openfreemap.org).
//   2. Repaint it with the Liikux palette below (dark graphite + yellow roads).
//   3. Show place and street names at lower zoom levels so you don't have to
//      zoom in far to see where you are.
//
// Run:  node scripts/build-map-style.mjs
// To change how the map looks, edit PALETTE and run the script again.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE = "https://tiles.openfreemap.org/styles/positron";
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "client", "public", "map", "liikux-style.json");

const PALETTE = {
  land: "#14161b", // base ground (a touch lighter than the page so the map reads as a panel)
  landuse: "#171a20", // residential areas
  park: "#16211c", // parks and forests (dark green tint)
  water: "#0b1a2a", // sea and lakes
  waterway: "#12273b", // rivers
  building: "#1b1f26",
  buildingLine: "#242933",
  roadMinor: "#2a2f39",
  roadMajor: "#3b414e",
  roadCasing: "#14161b",
  motorway: "#8a6a1c", // muted Liikux yellow
  motorwayCasing: "#2a2210",
  path: "#252a33",
  rail: "#242932",
  boundary: "#3d4350",
  text: "#b9bdc7", // street and place names
  textStrong: "#ecebe6", // cities
  textWater: "#4d86b8",
  halo: "#0d0e11",
};

const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`Could not download ${SOURCE}: ${res.status}`);
const style = await res.json();

const P = PALETTE;
const set = (layer, key, value) => {
  layer.paint = { ...(layer.paint || {}), [key]: value };
};

const layers = [];
for (const layer of style.layers) {
  const id = layer.id;

  // Road number shields are bright white badges: too noisy on a dark map.
  if (/shield/.test(id)) continue;

  if (id === "background") set(layer, "background-color", P.land);
  else if (id === "park") set(layer, "fill-color", P.park);
  else if (id === "water") set(layer, "fill-color", P.water);
  else if (id === "waterway") set(layer, "line-color", P.waterway);
  else if (id === "landuse_residential") set(layer, "fill-color", P.landuse);
  else if (id === "landcover_wood") set(layer, "fill-color", P.park);
  else if (id.startsWith("landcover_ice") || id.startsWith("landcover_glacier")) set(layer, "fill-color", "#1d2128");
  else if (id === "building") {
    set(layer, "fill-color", P.building);
    set(layer, "fill-outline-color", P.buildingLine);
  } else if (id.startsWith("aeroway")) {
    if (layer.type === "fill") set(layer, "fill-color", P.landuse);
    else set(layer, "line-color", P.roadMinor);
  } else if (id.startsWith("road_area_pier")) set(layer, "fill-color", P.land);
  else if (id === "road_pier") set(layer, "line-color", P.land);
  else if (id === "highway_path") set(layer, "line-color", P.path);
  else if (id === "highway_minor") set(layer, "line-color", P.roadMinor);
  else if (id === "highway_major_casing") set(layer, "line-color", P.roadCasing);
  else if (id === "highway_major_inner") set(layer, "line-color", P.roadMajor);
  else if (id === "highway_major_subtle") set(layer, "line-color", P.roadMinor);
  else if (/motorway.*casing/.test(id)) set(layer, "line-color", P.motorwayCasing);
  else if (/motorway.*inner/.test(id)) set(layer, "line-color", P.motorway);
  else if (/motorway.*subtle/.test(id)) set(layer, "line-color", P.roadMajor);
  else if (id.startsWith("railway")) {
    set(layer, "line-color", id.endsWith("dashline") ? P.land : P.rail);
  } else if (id.startsWith("boundary")) set(layer, "line-color", P.boundary);
  else if (id.startsWith("waterway_line_label") || id.startsWith("water_name")) {
    set(layer, "text-color", P.textWater);
    set(layer, "text-halo-color", P.halo);
  } else if (layer.type === "symbol") {
    const strong = /^label_(city|state|country)/.test(id);
    set(layer, "text-color", strong ? P.textStrong : P.text);
    set(layer, "text-halo-color", P.halo);
    set(layer, "text-halo-width", 1.4);
    set(layer, "text-halo-blur", 0.5);
  }

  // Names earlier, so you can find your way without zooming in a lot.
  if (id === "label_other") layer.minzoom = 10;
  if (id === "label_village") layer.minzoom = 9;
  if (id === "highway-name-major") layer.minzoom = 11;
  if (id === "highway-name-minor") layer.minzoom = 13.5;
  if (id === "highway-name-path") layer.minzoom = 15;

  layers.push(layer);
}

style.layers = layers;
style.name = "Liikux dark";
style.metadata = { ...(style.metadata || {}), "liikux:generated": "scripts/build-map-style.mjs" };

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(style));
console.log(`Wrote ${path.relative(process.cwd(), OUT)} (${layers.length} layers)`);
