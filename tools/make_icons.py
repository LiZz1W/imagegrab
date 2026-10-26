"""生成图提取 ImageGrab 的扩展图标（16/48/128 PNG）。"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "extension" / "icons"
SIZE = 512


def diagonal_gradient(size: int) -> Image.Image:
    x = np.linspace(0, 1, size)
    y = np.linspace(0, 1, size)
    xx, yy = np.meshgrid(x, y)
    t = np.clip((xx + yy) / 2, 0, 1)

    start = np.array([99, 102, 241], dtype=float)
    mid = np.array([139, 92, 246], dtype=float)
    end = np.array([6, 182, 212], dtype=float)

    rgb = np.zeros((size, size, 3), dtype=float)
    first = t <= 0.55
    rgb[first] = start + (mid - start) * (t[first, None] / 0.55)
    second = ~first
    rgb[second] = mid + (end - mid) * ((t[second, None] - 0.55) / 0.45)
    return Image.fromarray(rgb.astype(np.uint8), "RGB").convert("RGBA")


def make_icon() -> Image.Image:
    base = diagonal_gradient(SIZE)
    mask = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, SIZE, SIZE), radius=112, fill=255)
    icon = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    icon.paste(base, (0, 0), mask)

    draw = ImageDraw.Draw(icon)

    # 白色相框
    frame = (104, 112, 408, 372)
    draw.rounded_rectangle(frame, radius=34, outline=(255, 255, 255, 245), width=24)

    # 相框内的太阳与山峦
    draw.ellipse((168, 160, 220, 212), fill=(255, 255, 255, 235))
    draw.polygon(
        [(126, 352), (214, 258), (268, 306), (318, 262), (386, 352)],
        fill=(255, 255, 255, 235),
    )

    # 右下角下载徽标
    badge_center = (392, 392)
    badge_radius = 86
    draw.ellipse(
        (
            badge_center[0] - badge_radius,
            badge_center[1] - badge_radius,
            badge_center[0] + badge_radius,
            badge_center[1] + badge_radius,
        ),
        fill=(255, 255, 255, 255),
    )
    accent = (79, 70, 229, 255)
    # 箭头
    draw.line([(392, 344), (392, 414)], fill=accent, width=20)
    draw.line([(362, 388), (392, 420), (422, 388)], fill=accent, width=20, joint="curve")
    # 托盘
    draw.line([(348, 438), (436, 438)], fill=accent, width=18)

    return icon


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    icon = make_icon()
    for size in (128, 48, 16):
        icon.resize((size, size), Image.LANCZOS).save(OUT / f"icon{size}.png")
    print("icons saved:", ", ".join(str(p.name) for p in sorted(OUT.glob("*.png"))))


if __name__ == "__main__":
    main()
