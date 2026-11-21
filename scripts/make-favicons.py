"""
Makes the Liikux browser-tab icons from the smiley shape.

Run:   python scripts/make-favicons.py

Change the colours below and run it again; it rewrites every icon in
client/public/brand (and the old copies in client/public). The shape comes
from client/public/brand/shape-512.png (the white smiley, transparent face);
this script saves it there the first time it runs.

  BODY   = colour of the "U" smiley          (Liikux yellow)
  FACE   = colour of the eyes and the smile  (black)
  APPLE  = background behind the icon on iPhones (they need a solid colour)
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

BODY = (255, 200, 61)   # #ffc83d  Liikux yellow
FACE = (13, 14, 17)     # #0d0e11  graphite / black
APPLE = (13, 14, 17)    # background of apple-touch-icon.png

ROOT = Path(__file__).resolve().parent.parent
BRAND = ROOT / "client" / "public" / "brand"
PUBLIC = ROOT / "client" / "public"
SHAPE = BRAND / "shape-512.png"


def load_shape() -> Image.Image:
    """The smiley as white on transparent, 512 px. Saved once so it never changes."""
    if not SHAPE.exists():
        src = Image.open(BRAND / "favicon-512.png").convert("RGBA")
        src.save(SHAPE)
    return Image.open(SHAPE).convert("RGBA")


def paint(shape: Image.Image) -> Image.Image:
    """Yellow body, black face (the see-through eyes and smile become black)."""
    alpha = shape.getchannel("A")
    # Which transparent pixels are outside the smiley, and which are the face?
    binary = alpha.point(lambda v: 255 if v >= 128 else 0)
    outside = binary.copy()
    ImageDraw.floodfill(outside, (0, 0), 128)  # 0 = face holes, 128 = outside, 255 = body
    holes = outside.point(lambda v: 255 if v == 0 else 0)
    near_holes = holes.filter(ImageFilter.MaxFilter(5))  # holes plus their soft edge

    w, h = shape.size
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px_a, px_n, px_o = alpha.load(), near_holes.load(), out.load()
    for y in range(h):
        for x in range(w):
            a = px_a[x, y]
            if px_n[x, y]:
                # Face area: fully opaque, from black (hole) to yellow (body) along the soft edge.
                t = a / 255
                px_o[x, y] = tuple(round(BODY[i] * t + FACE[i] * (1 - t)) for i in range(3)) + (255,)
            elif a:
                px_o[x, y] = BODY + (a,)
    return out


def save(img: Image.Image, size: int, *names: Path) -> None:
    small = img.resize((size, size), Image.LANCZOS)
    for name in names:
        small.save(name)


def main() -> None:
    art = paint(load_shape())

    for size in (48, 96, 192, 512):
        # one icon for dark and light browser themes (the yellow works on both)
        save(art, size, BRAND / f"favicon-{size}.png", BRAND / f"favicon-{size}-light.png")
    for size in (48, 96, 192):
        save(art, size, PUBLIC / f"favicon-{size}.png", PUBLIC / f"favicon-{size}-dark.png")
    save(art, 256, PUBLIC / "favicon.png", PUBLIC / "favicon-dark.png")

    # .ico with several sizes inside
    art.resize((256, 256), Image.LANCZOS).save(
        BRAND / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)]
    )
    art.resize((256, 256), Image.LANCZOS).save(
        PUBLIC / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)]
    )

    # iPhone home screen: solid background, the smiley a bit smaller in the middle
    tile = Image.new("RGBA", (180, 180), APPLE + (255,))
    inner = art.resize((128, 128), Image.LANCZOS)
    tile.alpha_composite(inner, (26, 26))
    for name in (BRAND / "apple-touch-icon.png", PUBLIC / "apple-touch-icon.png", PUBLIC / "apple-touch-icon-dark.png"):
        tile.convert("RGB").save(name)

    print("Icons written to", BRAND)


if __name__ == "__main__":
    main()
