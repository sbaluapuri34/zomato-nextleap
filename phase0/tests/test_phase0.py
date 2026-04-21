import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def _read_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def parse_price(raw: str) -> int:
    cleaned = re.sub(r"[^\d]", "", raw)
    if not cleaned:
        raise ValueError("No numeric digits in price")
    return int(cleaned)


def parse_rating(raw: str) -> float:
    match = re.match(r"\s*([0-5](?:\.\d+)?)\s*(?:/\s*5)?\s*$", raw)
    if not match:
        raise ValueError("Invalid rating format")
    return float(match.group(1))


def canonicalize_cuisines(raw: str):
    tokens = [t.strip() for t in re.split(r"[,/]", raw) if t.strip()]
    seen = set()
    out = []
    for token in tokens:
        normalized = " ".join(word.capitalize() for word in token.split())
        if normalized not in seen:
            seen.add(normalized)
            out.append(normalized)
    return out


class TestPhase0Artifacts(unittest.TestCase):
    def test_phase0_files_exist(self):
        expected = [
            ROOT / "api_contract.json",
            ROOT / "dataset_field_mapping.json",
            ROOT / "data_quality_acceptance_criteria.md",
        ]
        for path in expected:
            self.assertTrue(path.exists(), f"Missing required file: {path}")

    def test_api_contract_has_required_sections(self):
        contract = _read_json(ROOT / "api_contract.json")
        self.assertIn("request_schema", contract)
        self.assertIn("response_schema", contract)
        self.assertEqual(
            contract["request_schema"]["required"],
            ["price", "place", "rating", "cuisine"],
        )
        self.assertEqual(
            contract["response_schema"]["required"],
            ["recommendations", "summary"],
        )

    def test_field_mapping_contains_mandatory_examples(self):
        mapping = _read_json(ROOT / "dataset_field_mapping.json")["mapping"]
        self.assertEqual(mapping["price"]["example_input"], "1,500")
        self.assertEqual(mapping["price"]["example_output"], 1500)
        self.assertEqual(mapping["rating"]["example_input"], "4.1/5")
        self.assertEqual(mapping["rating"]["example_output"], 4.1)
        self.assertIsInstance(mapping["cuisines"]["example_output"], list)

    def test_price_normalization_rule(self):
        self.assertEqual(parse_price("1,500"), 1500)
        self.assertEqual(parse_price("Rs. 2,250"), 2250)

    def test_rating_normalization_rule(self):
        self.assertEqual(parse_rating("4.1/5"), 4.1)
        self.assertEqual(parse_rating(" 3.8 "), 3.8)

    def test_cuisine_normalization_rule(self):
        self.assertEqual(
            canonicalize_cuisines("north indian, Chinese / mughlai, Chinese"),
            ["North Indian", "Chinese", "Mughlai"],
        )


if __name__ == "__main__":
    unittest.main()
