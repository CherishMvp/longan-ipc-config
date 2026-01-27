import sys
import zlib
import struct


def make_png(width, height):
    # Simple blue background with a white "S" approximation (or just a blue square for now)
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

    # IDAT (Blue pixel data)
    # RGB (0, 122, 204) #007ACC - VS Code blue-ish
    raw_data = b""
    for y in range(height):
        raw_data += b"\x00"  # Filter type 0
        for x in range(width):
            # Draw a simple border or just solid color
            raw_data += b"\x00\x7a\xcc"

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
    with open("public/icon.png", "wb") as f:
        f.write(make_png(256, 256))
    print("Icon generated")
