"""Create an honest short slideshow of RepoLensa's captured browser UI."""
from PIL import Image, ImageOps
from pathlib import Path

root = Path("docs/assets")
shots = [
    root / "homepage-screenshot.png",
    root / "architecture-screenshot.png",
    root / "health-report-screenshot.png",
    root / "byok-walkthrough-frame.png",
]
frames = []
for file in shots:
    original = Image.open(file).convert("RGB")
    # Consistent width with center crop to make a compact, readable GitHub GIF.
    image = ImageOps.fit(original, (900, 560), method=Image.Resampling.LANCZOS,
                         centering=(0.5, 0.18))
    frames.append(image.quantize(colors=96, method=Image.Quantize.FASTOCTREE))
if len(frames) != 4:
    raise RuntimeError("Screenshot sequence is incomplete")
frames[0].save(root / "demo-walkthrough.gif", save_all=True,
               append_images=frames[1:], duration=[1800, 2200, 2200, 1800],
               loop=0, optimize=True, disposal=2)
print("Saved", root / "demo-walkthrough.gif")
