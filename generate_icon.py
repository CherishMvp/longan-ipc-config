import zlib
import struct


def make_png(width, height):
    # Header
    png = b"\x89PNG\r\n\x1a\n"
    # IHDR
    ihdr = struct.pack("!IIBBBBB", width, height, 8, 2, 0, 0, 0)
    png += (
        struct.pack("!I", len(ihdr))
        + b"IHDR"
        + ihdr
        + struct.pack("!I", zlib.crc32(b"IHDR" + ihdr))
    )

    # IDAT
    # Draw: Black background (#09090B), White "S" shape
    raw_data = b""
    for y in range(height):
        raw_data += b"\x00"  # Filter type 0
        for x in range(width):
            # Background: #09090B (Zinc 950)
            r, g, b_val = 9, 9, 11

            # Simple "S" shape logic (very pixelated approximation for 256x256)
            # Center area
            cx, cy = width // 2, height // 2
            s_width = width // 3
            s_height = height // 2
            s_thick = width // 10

            is_white = False

            # Top bar
            if (cx - s_width // 2 < x < cx + s_width // 2) and (
                cy - s_height // 2 < y < cy - s_height // 2 + s_thick
            ):
                is_white = True
            # Middle bar
            if (cx - s_width // 2 < x < cx + s_width // 2) and (
                cy - s_thick // 2 < y < cy + s_thick // 2
            ):
                is_white = True
            # Bottom bar
            if (cx - s_width // 2 < x < cx + s_width // 2) and (
                cy + s_height // 2 - s_thick < y < cy + s_height // 2
            ):
                is_white = True
            # Top-Left vertical
            if (cx - s_width // 2 < x < cx - s_width // 2 + s_thick) and (
                cy - s_height // 2 < y < cy
            ):
                is_white = True
            # Bottom-Right vertical
            if (cx + s_width // 2 - s_thick < x < cx + s_width // 2) and (
                cy < y < cy + s_height // 2
            ):
                is_white = True

            if is_white:
                raw_data += b"\xff\xff\xff"  # White
            else:
                raw_data += struct.pack("BBB", r, g, b_val)

    compressed = zlib.compress(raw_data)
    png += (
        struct.pack("!I", len(compressed))
        + b"IDAT"
        + compressed
        + struct.pack("!I", zlib.crc32(b"IDAT" + compressed))
    )

    # IEND
    png += struct.pack("!I", 0) + b"IEND" + struct.pack("!I", zlib.crc32(b"IEND"))
    return png


if __name__ == "__main__":
    icon_data = make_png(256, 256)
    with open("public/icon.png", "wb") as f:
        f.write(icon_data)
    # Also update build icon
    import os

    if not os.path.exists("electron/build"):
        os.makedirs("electron/build")
    with open("electron/build/icon.png", "wb") as f:
        f.write(icon_data)
    print("Generated style-matched icon")
