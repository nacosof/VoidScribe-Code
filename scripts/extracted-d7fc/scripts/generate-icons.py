"""Генерация иконок: title bar (чёткий оригинал) и панель задач (круг + фон)."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "resources" / "icon.png"
ASSETS = ROOT / "src" / "assets"
OUT_ICO = ROOT / "resources" / "icon.ico"
OUT_TASKBAR = ROOT / "resources" / "icon-taskbar.png"

# Брендовый фиолетовый — контраст на тёмной панели задач
TASKBAR_BG = (81, 44, 132, 255)


def supersample(img: Image.Image, size: int) -> Image.Image:
    if size <= 0:
        raise ValueError("size must be positive")
    w, h = img.size
    if w == size and h == size:
        return img.copy()
    scale = max(2, (max(w, h) + size - 1) // size)
    mid = max(size, w * scale // max(w, h) if w >= h else h * scale // max(w, h))
    # Двухшаговый даунскейл для резкости
    step = max(size * 2, min(w, h))
    if max(w, h) > step:
        ratio = step / max(w, h)
        mid_w = max(1, round(w * ratio))
        mid_h = max(1, round(h * ratio))
        img = img.resize((mid_w, mid_h), Image.Resampling.LANCZOS)
    return img.resize((size, size), Image.Resampling.LANCZOS)


def write_header_icons(src: Image.Image) -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    pairs = [
        ("icon-header-20.png", 20),
        ("icon-header-40.png", 40),
        ("icon-header-80.png", 80),
    ]
    for name, size in pairs:
        out = ASSETS / name
        supersample(src, size).save(out, optimize=True)
        print(f"  {out.name} ({size}px)")


def logo_on_circle(src: Image.Image, size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse((0, 0, size - 1, size - 1), fill=TASKBAR_BG)

    inset = max(1, round(size * 0.06))
    logo_size = size - inset * 2
    logo = supersample(src, logo_size)
    if size <= 24:
        logo = ImageEnhance.Contrast(logo).enhance(1.15)
        logo = ImageEnhance.Sharpness(logo).enhance(1.2)

    img.paste(logo, (inset, inset), logo)
    return img


def write_taskbar_icons(src: Image.Image) -> None:
    sizes_list = [16, 20, 24, 32, 48, 64, 128, 256]
    images = [logo_on_circle(src, s) for s in sizes_list]
    sizes = [(s, s) for s in sizes_list]

    images[0].save(OUT_ICO, format="ICO", sizes=sizes, append_images=images[1:])
    logo_on_circle(src, 256).save(OUT_TASKBAR)
    print(f"  icon.ico ({len(images)} sizes)")
    print(f"  icon-taskbar.png")


def main() -> None:
    src = Image.open(SRC).convert("RGBA")
    print("Header icons:")
    write_header_icons(src)
    print("Taskbar icons:")
    write_taskbar_icons(src)


if __name__ == "__main__":
    main()
