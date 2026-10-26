"""把 extension/ 打包为可直接分发的 ImageGrab-1.0.0.zip。"""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "extension"
OUT = ROOT / "docs" / "downloads" / "ImageGrab-1.0.0.zip"
TOP = "ImageGrab-1.0.0"


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    if OUT.exists():
        OUT.unlink()

    files = sorted(p for p in SRC.rglob("*") if p.is_file())
    with ZipFile(OUT, "w", ZIP_DEFLATED) as archive:
        for path in files:
            archive.write(path, f"{TOP}/{path.relative_to(SRC).as_posix()}")

    size_kb = OUT.stat().st_size / 1024
    print(f"saved: {OUT} ({len(files)} files, {size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
