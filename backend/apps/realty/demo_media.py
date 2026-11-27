"""Demo rasmlar generatori (Pillow).

Qurilish kompaniyasi real rasmlarni berguncha demo loyihalarda shu rasmlar turadi:
fasad vizualizatsiyalari (kunduzi/kechqurun), hovli, interyer, qurilish jarayoni
va planirovka chizmalari. Internetdan hech narsa yuklanmaydi — hammasi kodda chiziladi.
"""

import math
import random
from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1600, 1000


def _font(size: int):
    try:
        return ImageFont.load_default(size=size)
    except TypeError:  # juda eski Pillow
        return ImageFont.load_default()


def _gradient(size, top, bottom):
    w, h = size
    img = Image.new("RGB", size)
    px = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(h - 1, 1)
        px.line([(0, y), (w, y)], fill=tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return img


def _noise(img, amount=6, seed=0):
    rnd = random.Random(seed)
    noise = Image.effect_noise(img.size, amount * 4).convert("RGB")
    out = Image.blend(img, noise, 0.04)
    return out.filter(ImageFilter.GaussianBlur(0.4)) if rnd.random() > -1 else out


def _m2(d, center, prefix: str, font, fill, anchor="mm"):
    """Shriftda "²" yo'q — "m" dan keyin kichik "2" ni yuqoriroqqa chizamiz."""
    sup = _font(max(int(font.size * 0.6), 10)) if hasattr(font, "size") else font
    text = f"{prefix} m"
    tw = d.textlength(text, font=font)
    sw = d.textlength("2", font=sup)
    cx, cy = center
    x = cx - (tw + sw) / 2 if anchor == "mm" else cx
    y = cy
    d.text((x, y), text, fill=fill, font=font, anchor="lm")
    d.text((x + tw + 1, y - font.size * 0.28), "2", fill=fill, font=sup, anchor="lm")


def _to_upload(img: Image.Image, name: str) -> SimpleUploadedFile:
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return SimpleUploadedFile(name, buf.getvalue(), content_type="image/jpeg")


# ------------------------------- Fasad -------------------------------

PALETTES = {
    "day": {"sky": ((92, 148, 205), (214, 228, 240)), "ground": (58, 66, 58), "lit": 0.0},
    "dusk": {"sky": ((24, 34, 66), (238, 160, 108)), "ground": (30, 30, 34), "lit": 0.55},
    "night": {"sky": ((8, 12, 26), (40, 48, 82)), "ground": (16, 16, 20), "lit": 0.7},
}
FACADES = [(232, 226, 214), (204, 196, 184), (176, 168, 160), (226, 222, 216), (120, 110, 104)]


def facade(seed: int, mood: str = "day", towers: int = 3) -> Image.Image:
    rnd = random.Random(seed)
    pal = PALETTES[mood]
    img = _gradient((W, H), *pal["sky"])
    d = ImageDraw.Draw(img, "RGBA")

    # uzoqdagi shahar siluetlari
    x = 0
    while x < W:
        bw, bh = rnd.randint(40, 110), rnd.randint(60, 220)
        d.rectangle([x, 760 - bh, x + bw, 760], fill=(*[int(c * 0.55) for c in pal["sky"][1]], 160))
        x += bw + rnd.randint(0, 20)

    horizon = 780
    d.rectangle([0, horizon, W, H], fill=pal["ground"])

    total_w = W - 220
    gap = 60
    tw = (total_w - gap * (towers - 1)) // towers
    for t in range(towers):
        floors = rnd.randint(12, 20)
        fh = 30
        bx = 110 + t * (tw + gap)
        top = horizon - floors * fh - 40
        color = FACADES[(seed + t) % len(FACADES)]
        shade = tuple(int(c * 0.72) for c in color)
        # yon devor (hajm)
        d.polygon([(bx + tw, top), (bx + tw + 26, top + 18), (bx + tw + 26, horizon), (bx + tw, horizon)], fill=shade)
        d.rectangle([bx, top, bx + tw, horizon], fill=color)
        d.rectangle([bx - 6, top - 10, bx + tw + 6, top], fill=tuple(int(c * 0.6) for c in color))  # parapet
        # 1-qavat — tijorat vitrinalari
        d.rectangle([bx, horizon - 46, bx + tw, horizon], fill=(40, 46, 52))
        for vx in range(bx + 10, bx + tw - 30, 46):
            glow = (255, 214, 150, 200) if pal["lit"] else (130, 160, 180, 220)
            d.rectangle([vx, horizon - 40, vx + 36, horizon - 6], fill=glow)
        # derazalar
        cols = max(4, tw // 34)
        cw = tw / cols
        for f in range(floors):
            y = top + 14 + f * fh
            if y > horizon - 60:
                break
            for c in range(cols):
                wx = bx + c * cw + cw * 0.18
                lit = rnd.random() < pal["lit"]
                fill = (255, rnd.randint(196, 226), 140, 255) if lit else (
                    (70, 96, 120, 255) if mood == "day" else (38, 44, 58, 255)
                )
                d.rectangle([wx, y, wx + cw * 0.64, y + fh * 0.62], fill=fill)
                if mood == "day" and rnd.random() < 0.35:  # osmon aksi
                    d.polygon([(wx, y + fh * 0.62), (wx + cw * 0.3, y), (wx + cw * 0.44, y), (wx + cw * 0.14, y + fh * 0.62)], fill=(200, 222, 240, 90))
            if f % 2 == 0:  # balkon chizig'i
                d.rectangle([bx, y + fh * 0.7, bx + tw, y + fh * 0.76], fill=(*shade, 255))

    # daraxtlar va yo'lak
    d.rectangle([0, horizon + 70, W, horizon + 96], fill=(90, 90, 92) if mood == "day" else (44, 44, 48))
    for i in range(26):
        tx = rnd.randint(-20, W)
        ty = horizon + rnd.randint(10, 60)
        r = rnd.randint(22, 46)
        g = (46 + rnd.randint(0, 30), 84 + rnd.randint(0, 40), 50) if mood == "day" else (20, 34, 26)
        d.rectangle([tx - 3, ty, tx + 3, ty + r + 10], fill=(60, 44, 34))
        d.ellipse([tx - r, ty - r, tx + r, ty + r * 0.8], fill=g)
    if pal["lit"]:
        for lx in range(60, W, 180):  # fonarlar
            d.line([(lx, horizon + 70), (lx, horizon + 10)], fill=(30, 30, 30), width=4)
            d.ellipse([lx - 26, horizon - 6, lx + 26, horizon + 34], fill=(255, 210, 140, 60))
            d.ellipse([lx - 6, horizon + 4, lx + 6, horizon + 16], fill=(255, 230, 180))
    return _noise(img, seed=seed)


def courtyard(seed: int) -> Image.Image:
    rnd = random.Random(seed)
    img = _gradient((W, H), (120, 170, 214), (226, 236, 242))
    d = ImageDraw.Draw(img, "RGBA")
    # orqa fonda bino
    d.rectangle([0, 160, W, 600], fill=(222, 216, 204))
    for y in range(190, 580, 34):
        for x in range(20, W, 56):
            d.rectangle([x, y, x + 34, y + 20], fill=(82, 108, 132))
    # maysa, yo'laklar, bolalar maydonchasi
    d.rectangle([0, 600, W, H], fill=(86, 132, 74))
    d.polygon([(700, 600), (900, 600), (1300, H), (300, H)], fill=(196, 190, 176))
    d.ellipse([140, 700, 520, 900], fill=(214, 120, 84))  # rezina qoplama
    d.rectangle([250, 690, 270, 800], fill=(240, 196, 60))
    d.rectangle([380, 690, 400, 800], fill=(240, 196, 60))
    d.rectangle([240, 680, 410, 700], fill=(60, 130, 200))
    d.line([(300, 700), (300, 780)], fill=(40, 40, 40), width=3)
    d.line([(350, 700), (350, 780)], fill=(40, 40, 40), width=3)
    for i in range(14):
        tx, ty, r = rnd.randint(900, W), rnd.randint(620, 900), rnd.randint(30, 60)
        d.ellipse([tx - r, ty - r * 1.3, tx + r, ty + r * 0.6], fill=(52 + rnd.randint(0, 30), 104, 56))
    for bx in (980, 1180, 1380):  # o'rindiqlar
        d.rectangle([bx, 880, bx + 120, 896], fill=(120, 84, 56))
    return _noise(img, seed=seed)


def interior(seed: int) -> Image.Image:
    rnd = random.Random(seed)
    img = Image.new("RGB", (W, H), (236, 232, 224))
    d = ImageDraw.Draw(img, "RGBA")
    # pol (parket) perspektivada
    d.polygon([(0, 700), (W, 700), (W, H), (0, H)], fill=(176, 136, 98))
    for i in range(-20, 30):
        x0 = 800 + i * 60
        d.line([(800 + i * 22, 700), (x0 * 1.0 + (x0 - 800) * 1.2, H)], fill=(150, 112, 80), width=2)
    # deraza
    d.rectangle([900, 140, 1420, 640], fill=(250, 250, 246))
    sky = _gradient((480, 460), (150, 196, 232), (238, 244, 248))
    img.paste(sky, (920, 160))
    d.line([(1160, 160), (1160, 620)], fill=(250, 250, 246), width=12)
    d.polygon([(920, 700), (1400, 700), (1600, H), (700, H)], fill=(255, 250, 230, 70))  # quyosh nuri
    # divan, stolcha, gilam, lampa
    d.rounded_rectangle([140, 520, 760, 720], 30, fill=(92, 98, 108))
    d.rounded_rectangle([160, 440, 740, 560], 30, fill=(104, 110, 122))
    d.ellipse([260, 780, 820, 920], fill=(214, 206, 190))
    d.rounded_rectangle([420, 740, 640, 790], 10, fill=(70, 52, 40))
    d.line([(820, 300), (820, 700)], fill=(40, 40, 40), width=5)
    d.polygon([(770, 300), (870, 300), (850, 240), (790, 240)], fill=(240, 220, 180))
    # devordagi rasm
    d.rectangle([260, 200, 620, 400], fill=(60, 64, 70))
    d.rectangle([276, 216, 604, 384], fill=_hue(seed))
    if rnd.random() > 0.5:
        d.ellipse([500, 600, 560, 720], fill=(64, 120, 70))  # o'simlik
    return _noise(img, seed=seed)


def _hue(seed):
    rnd = random.Random(seed)
    return (rnd.randint(140, 220), rnd.randint(120, 200), rnd.randint(100, 180))


def construction(seed: int) -> Image.Image:
    rnd = random.Random(seed)
    img = _gradient((W, H), (148, 180, 210), (230, 226, 216))
    d = ImageDraw.Draw(img, "RGBA")
    d.rectangle([0, 800, W, H], fill=(150, 128, 100))
    # beton karkas
    bx, by, bw = 380, 300, 760
    floors = 10
    for f in range(floors):
        y = 800 - (f + 1) * 50
        d.rectangle([bx, y, bx + bw, y + 10], fill=(170, 170, 168))
        for c in range(9):
            cx = bx + c * (bw / 8)
            d.rectangle([cx - 6, y + 10, cx + 6, y + 50], fill=(150, 150, 148))
        if f < 6:
            for c in range(8):
                cx = bx + c * (bw / 8) + 12
                d.rectangle([cx, y + 14, cx + bw / 8 - 24, y + 46], fill=(178, 92, 70) if rnd.random() > 0.3 else (120, 120, 120))
    # kran
    d.rectangle([1260, 120, 1290, 800], fill=(236, 186, 40))
    for y in range(130, 800, 30):
        d.line([(1260, y), (1290, y + 30)], fill=(180, 140, 30), width=3)
    d.rectangle([700, 110, 1500, 135], fill=(236, 186, 40))
    d.line([(1000, 135), (1000, 360)], fill=(40, 40, 40), width=2)
    d.rectangle([980, 360, 1020, 380], fill=(80, 80, 80))
    # to'siq banneri
    d.rectangle([0, 780, W, 820], fill=(30, 34, 40))
    d.text((40, 787), "QURILISH DAVOM ETMOQDA", fill=(236, 194, 122), font=_font(26))
    return _noise(img, seed=seed)


# ------------------------------ Planirovka ------------------------------

def floor_plan(rooms: int, area: float, seed: int = 0) -> Image.Image:
    """Arxitektura chizmasi uslubidagi planirovka: qalin devorlar, eshik yoylari, derazalar, o'lchamlar."""
    w, h = 1600, 1150
    img = Image.new("RGB", (w, h), (246, 245, 240))
    d = ImageDraw.Draw(img)
    ink, thin = (28, 30, 34), (150, 152, 156)
    f_label, f_small, f_title = _font(30), _font(24), _font(40)

    pad_x, pad_y = 140, 150
    iw, ih = w - pad_x * 2, h - pad_y - 170
    x0, y0, x1, y1 = pad_x, pad_y, pad_x + iw, pad_y + ih

    # xonalarni bo'lish (frontenddagi PlanSketch bilan bir xil mantiq)
    cells = []
    hall_w = iw * 0.24
    cells.append((x0, y0 + ih * 0.55, x0 + hall_w, y1, "Dahliz"))
    cells.append((x0, y0, x0 + hall_w, y0 + ih * 0.55, "Oshxona"))
    rx, rw = x0 + hall_w, iw - hall_w
    n = max(rooms, 1)
    if n <= 2:
        for i in range(n):
            name = "Studiya" if rooms == 0 else ("Mehmonxona" if i == 0 else "Yotoqxona")
            cells.append((rx + rw / n * i, y0, rx + rw / n * (i + 1), y0 + ih * 0.72, name))
        cells.append((rx, y0 + ih * 0.72, rx + rw * 0.45, y1, "Hammom"))
        cells.append((rx + rw * 0.45, y0 + ih * 0.72, x1, y1, "Balkon"))
    else:
        top = math.ceil(n / 2)
        bottom = n - top
        for i in range(top):
            cells.append((rx + rw / top * i, y0, rx + rw / top * (i + 1), y0 + ih * 0.5, "Mehmonxona" if i == 0 else "Yotoqxona"))
        bw = rw * 0.7
        for i in range(bottom):
            cells.append((rx + bw / bottom * i, y0 + ih * 0.5, rx + bw / bottom * (i + 1), y1, "Yotoqxona"))
        cells.append((rx + bw, y0 + ih * 0.5, x1, y1, "Hammom"))

    total_px = iw * ih
    for cx0, cy0, cx1, cy1, name in cells:
        if name == "Balkon":
            d.rectangle([cx0, cy0, cx1, cy1], fill=(232, 238, 244))
        if name in ("Mehmonxona", "Yotoqxona", "Studiya"):  # parket chiziqlari
            for yy in range(int(cy0) + 18, int(cy1), 18):
                d.line([(cx0 + 6, yy), (cx1 - 6, yy)], fill=(236, 232, 222), width=1)
        d.rectangle([cx0, cy0, cx1, cy1], outline=ink, width=6)
        room_area = area * ((cx1 - cx0) * (cy1 - cy0)) / total_px
        cxm, cym = (cx0 + cx1) / 2, (cy0 + cy1) / 2
        d.text((cxm, cym - 16), name, fill=ink, font=f_label, anchor="mm")
        _m2(d, (cxm, cym + 20), f"{room_area:.1f}", f_small, thin)
        # eshik: devorda bo'shliq + yoy
        dx, dy = cx0 + 24, cy1
        d.line([(dx, dy), (dx + 70, dy)], fill=(246, 245, 240), width=8)
        d.arc([dx - 70, dy - 70, dx + 70, dy + 70], 270, 360, fill=thin, width=2)
        d.line([(dx, dy), (dx, dy - 70)], fill=ink, width=3)

    # tashqi qalin devor va derazalar
    d.rectangle([x0, y0, x1, y1], outline=ink, width=14)
    for wx in range(int(rx + 60), int(x1 - 120), 260):
        d.rectangle([wx, y0 - 7, wx + 120, y0 + 7], fill=(246, 245, 240), outline=ink, width=2)
        d.line([(wx, y0), (wx + 120, y0)], fill=ink, width=2)

    # o'lcham chizig'i
    side = math.sqrt(area * iw / ih)
    d.line([(x0, y0 - 60), (x1, y0 - 60)], fill=thin, width=2)
    for xx in (x0, x1):
        d.line([(xx, y0 - 72), (xx, y0 - 48)], fill=thin, width=2)
    d.text(((x0 + x1) / 2, y0 - 84), f"{side:.2f} m", fill=thin, font=f_small, anchor="mm")

    title = "Studiya" if rooms == 0 else f"{rooms} xonali kvartira"
    d.text((pad_x, h - 110), title, fill=ink, font=f_title)
    label = f"Umumiy maydon: {area:g}"
    _m2(d, (pad_x, h - 48), label, f_small, thin, anchor="lm")
    d.text((pad_x + d.textlength(label + " m2", font=f_small) + 24, h - 48), "·  demo chizma", fill=thin, font=f_small, anchor="lm")
    # shimol belgisi
    d.polygon([(w - 150, h - 120), (w - 135, h - 70), (w - 150, h - 82), (w - 165, h - 70)], fill=ink)
    d.text((w - 150, h - 135), "N", fill=ink, font=f_small, anchor="mm")
    return img


def project_photo_set(seed: int):
    """Loyiha uchun (fayl, tur, izoh) ro'yxati."""
    return [
        (_to_upload(facade(seed, "dusk", 3), "render-dusk.jpg"), "render", "Majmua kechqurun"),
        (_to_upload(facade(seed + 1, "day", 2), "render-day.jpg"), "render", "Asosiy fasad"),
        (_to_upload(courtyard(seed + 2), "courtyard.jpg"), "territory", "Yopiq hovli va bolalar maydonchasi"),
        (_to_upload(interior(seed + 3), "interior.jpg"), "interior", "Namunaviy xonadon — mehmonxona"),
        (_to_upload(facade(seed + 4, "night", 4), "render-night.jpg"), "exterior", "Tungi yoritish"),
        (_to_upload(construction(seed + 5), "progress.jpg"), "progress", "Qurilish jarayoni"),
    ]


def floor_plan_upload(rooms: int, area: float, seed: int = 0) -> SimpleUploadedFile:
    buf = BytesIO()
    floor_plan(rooms, area, seed).save(buf, format="PNG", optimize=True)
    return SimpleUploadedFile("plan.png", buf.getvalue(), content_type="image/png")
