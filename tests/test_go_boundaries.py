import re
from pathlib import Path


def test_core_inner_layers_do_not_import_adapters_or_web_frameworks():
    root = Path(__file__).resolve().parents[1] / "core" / "internal"
    for path in root.rglob("*.go"):
        if path.name.endswith("_test.go"):
            continue
        if "application" not in path.parts and "domain" not in path.parts:
            continue
        source = path.read_text()
        imports = re.findall(r'"([^"\n]+)"', source.split("\n)", 1)[0])
        assert not any(
            "/infrastructure/" in value or "/presentation/" in value for value in imports
        ), path
        assert not any(
            "gin-gonic" in value or "mongo-driver" in value or "kafka-go" in value
            for value in imports
        ), path
