from pathlib import Path

from PIL import Image

assets = Path(
    r"C:\Users\jusuf\.cursor\projects\c-Users-jusuf-projects-liikux\assets"
)
out = Path(r"C:\Users\jusuf\projects\liikux\client\public\lajit")
out.mkdir(parents=True, exist_ok=True)

mapping = {
    "juoksu": "c__Users_jusuf_AppData_Roaming_Cursor_User_workspaceStorage_b6d3cf2adc9c28e2cb40edae292f328c_images_running-2e19589d-607d-487e-a83c-e80bd60acb62.gif",
    "pyoraily": "c__Users_jusuf_AppData_Roaming_Cursor_User_workspaceStorage_b6d3cf2adc9c28e2cb40edae292f328c_images_cycling-5c74fb3a-2d77-47b0-895d-5b2d7241b6aa.gif",
    "uinti": "c__Users_jusuf_AppData_Roaming_Cursor_User_workspaceStorage_b6d3cf2adc9c28e2cb40edae292f328c_images_swimmer-85a7ff90-0190-44b5-a8ae-c804b101fec6.gif",
    "kiipeily": "c__Users_jusuf_AppData_Roaming_Cursor_User_workspaceStorage_b6d3cf2adc9c28e2cb40edae292f328c_images_climbing-99c5291e-8165-4535-98ff-f6308658f76c.jpg",
    "tennis": "c__Users_jusuf_AppData_Roaming_Cursor_User_workspaceStorage_b6d3cf2adc9c28e2cb40edae292f328c_images_tennis-racket-2f8a2897-b563-48a1-ac2e-2b0b921a58d1.jpg",
    "padeli": "c__Users_jusuf_AppData_Roaming_Cursor_User_workspaceStorage_b6d3cf2adc9c28e2cb40edae292f328c_images_padel-11922e76-cc20-4cef-a394-e5f741d615ac.jpg",
    "kuntosali": "c__Users_jusuf_AppData_Roaming_Cursor_User_workspaceStorage_b6d3cf2adc9c28e2cb40edae292f328c_images_weight-lifting-65dda1e4-6419-48e0-8e91-99e6c5ae04f6.jpg",
    "koripallo": "c__Users_jusuf_AppData_Roaming_Cursor_User_workspaceStorage_b6d3cf2adc9c28e2cb40edae292f328c_images_basketball-1d2ea796-1998-4d2a-8e67-0cc7602373ae.jpg",
}

WHITE = 248
BLACK = 18


def clear_bg(im: Image.Image, remove_black: bool) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 128:
                px[x, y] = (255, 255, 255, 0)
                continue
            if r >= WHITE and g >= WHITE and b >= WHITE:
                px[x, y] = (255, 255, 255, 0)
                continue
            if remove_black and r <= BLACK and g <= BLACK and b <= BLACK:
                px[x, y] = (255, 255, 255, 0)
                continue
            if (
                min(r, g, b) >= 230
                and abs(r - g) < 12
                and abs(g - b) < 12
                and abs(r - b) < 12
            ):
                softness = (min(r, g, b) - 230) / 25.0
                px[x, y] = (r, g, b, max(0, int(a * (1 - softness))))
    return im


def rgba_to_p_transparent(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    alpha = im.getchannel("A").point(lambda a: 0 if a < 128 else 255)
    rgb = Image.new("RGB", im.size, (0, 0, 0))
    opaque_mask = Image.eval(alpha, lambda a: 255 if a == 255 else 0)
    rgb.paste(im, mask=opaque_mask)

    quantized = rgb.quantize(colors=255, method=Image.MEDIANCUT)
    palette = quantized.getpalette()[: 255 * 3]
    new_palette = [0, 0, 0] + list(palette)
    new_palette = new_palette + [0] * (768 - len(new_palette))

    src = quantized.tobytes()
    mask_bytes = alpha.tobytes()
    data = bytearray(len(src))
    for i, (pix, a) in enumerate(zip(src, mask_bytes)):
        data[i] = 0 if a == 0 else pix + 1

    out_im = Image.frombytes("P", quantized.size, bytes(data))
    out_im.putpalette(new_palette)
    out_im.info["transparency"] = 0
    return out_im


def needs_black_removal(im: Image.Image) -> bool:
    sample = im.convert("RGBA").getpixel((0, 0))
    return sample[3] >= 200 and sample[0] <= BLACK and sample[1] <= BLACK and sample[2] <= BLACK


def process(src_name: str, dest_name: str) -> None:
    src = assets / src_name
    dest = out / f"{dest_name}.gif"
    im = Image.open(src)
    remove_black = needs_black_removal(im)
    frames = []
    durations = []
    n = getattr(im, "n_frames", 1)
    for i in range(n):
        im.seek(i)
        frame = clear_bg(im.copy(), remove_black)
        frame = frame.resize((160, 160), Image.Resampling.LANCZOS)
        frames.append(rgba_to_p_transparent(frame))
        durations.append(im.info.get("duration", 60) or 60)

    first, rest = frames[0], frames[1:]
    first.save(
        dest,
        save_all=bool(rest),
        append_images=rest,
        duration=durations if rest else durations[0],
        loop=0,
        disposal=2,
        transparency=0,
        optimize=False,
    )
    print(
        f"{dest_name}: {n} frames black={remove_black} -> {dest.name} ({dest.stat().st_size} bytes)"
    )


for name, src in mapping.items():
    process(src, name)

print("done")
