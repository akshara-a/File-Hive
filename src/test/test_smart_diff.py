import csv
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import read_data_file


class SmartDiffDuplicateKeyTests(unittest.TestCase):
    def write_csv(self, path, rows):
        with open(path, "w", newline="", encoding="utf-8") as output:
            writer = csv.writer(output)
            writer.writerow(["id", "value"])
            writer.writerows(rows)

    def test_duplicate_in_either_file_returns_clear_error(self):
        with tempfile.TemporaryDirectory() as directory:
            base_path = os.path.join(directory, "base.csv")
            compare_path = os.path.join(directory, "compare.csv")

            for duplicate_side in ("base", "compare"):
                base_rows = [(1, "one"), (2, "two")]
                compare_rows = [(1, "one"), (2, "two")]
                if duplicate_side == "base":
                    base_rows.append((1, "duplicate"))
                else:
                    compare_rows.append((1, "duplicate"))
                self.write_csv(base_path, base_rows)
                self.write_csv(compare_path, compare_rows)

                with self.subTest(duplicate_side=duplicate_side):
                    result = read_data_file.smart_diff_data_files(base_path, compare_path)
                    self.assertFalse(result["success"])
                    self.assertIn("inferred key", result["error"])
                    self.assertIn("duplicate values", result["error"])
                    self.assertIn(f"{duplicate_side} file", result["error"])


if __name__ == "__main__":
    unittest.main()
