"""Generate high quality extension icons for FraudShield AI."""
from pathlib import Path
from PIL import Image, ImageDraw

icons_dir = Path(__file__).resolve().parent / "icons"
icons_dir.mkdir(parents=True, exist_ok=True)

def create_shield_icon(size: int) -> Image.Image:
    # Render at 4x for clean downsampling/antialiasing
    scale = 4
    canvas_size = size * scale
    img = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Padding
    pad = int(canvas_size * 0.08)
    w = canvas_size - 2 * pad
    h = canvas_size - 2 * pad

    # Shield polygon points
    # top-left, top-right, right-mid, bottom-tip, left-mid
    x0, y0 = pad, pad
    x1, y1 = pad + w, pad + h
    mid_x = canvas_size // 2
    
    # Outer shield contour
    outer_points = [
        (pad + int(w * 0.1), y0),
        (pad + int(w * 0.9), y0),
        (x1, pad + int(h * 0.45)),
        (mid_x, y1),
        (x0, pad + int(h * 0.45)),
    ]
    
    # Dark modern background shield
    draw.polygon(outer_points, fill=(11, 19, 43, 255))
    
    # Cyan gradient / border
    border_width = max(2, int(scale * 1.5))
    draw.polygon(outer_points, outline=(6, 182, 212, 255), width=border_width)

    # Inner shield accent
    inner_pad = int(canvas_size * 0.18)
    iw = canvas_size - 2 * inner_pad
    ih = canvas_size - 2 * inner_pad
    ix0, iy0 = inner_pad, inner_pad
    ix1, iy1 = inner_pad + iw, inner_pad + ih
    
    inner_points = [
        (inner_pad + int(iw * 0.15), iy0 + int(ih * 0.08)),
        (inner_pad + int(iw * 0.85), iy0 + int(ih * 0.08)),
        (ix1, inner_pad + int(ih * 0.48)),
        (mid_x, iy1),
        (ix0, inner_pad + int(ih * 0.48)),
    ]
    draw.polygon(inner_points, fill=(15, 23, 42, 255), outline=(56, 189, 248, 200), width=max(1, int(scale)))

    # Draw a stylized glowing 'F' / 'Check' or lightning lock
    # Let's draw a cyber checkmark / keyhole
    cx, cy = mid_x, int(canvas_size * 0.48)
    cr = int(canvas_size * 0.13)
    # Circle
    draw.ellipse([(cx - cr, cy - cr), (cx + cr, cy + cr)], fill=(34, 211, 238, 255))
    # Vertical slit
    slit_w = max(2, int(cr * 0.4))
    slit_h = int(cr * 1.6)
    draw.rectangle([(cx - slit_w // 2, cy), (cx + slit_w // 2, cy + slit_h)], fill=(34, 211, 238, 255))

    # Resize with high quality Lanczos filter
    final_img = img.resize((size, size), Image.Resampling.LANCZOS)
    return final_img

for s in [16, 48, 128]:
    icon = create_shield_icon(s)
    path = icons_dir / f"icon{s}.png"
    icon.save(path, format="PNG")
    print(f"Generated {path} ({s}x{s})")

print("All icons created successfully.")
