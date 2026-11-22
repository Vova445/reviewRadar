import json
import sqlite3
import sys

source_path, output_path = sys.argv[1:3]
connection = sqlite3.connect(":memory:")
with open(source_path, "r", encoding="utf-8") as backup_file:
    connection.executescript(backup_file.read())

tables = [row[0] for row in connection.execute(
    "SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
)]
counts = {table: connection.execute(f"SELECT COUNT(*) FROM \"{table.replace(chr(34), chr(34) * 2)}\"").fetchone()[0] for table in tables}
with open(output_path, "w", encoding="utf-8") as manifest_file:
    json.dump(counts, manifest_file, sort_keys=True, separators=(",", ":"))
    manifest_file.write("\n")
