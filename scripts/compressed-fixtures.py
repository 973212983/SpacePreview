import bz2
import lzma
from pathlib import Path

destination = Path(__file__).resolve().parent.parent / "test-results" / "fixtures"
destination.mkdir(parents=True, exist_ok=True)
content = "独立压缩流完整中文内容".encode("utf-8")
for extension, compress in [("bz2", bz2.compress), ("xz", lzma.compress)]:
    (destination / f"hello.txt.{extension}").write_bytes(compress(content))
