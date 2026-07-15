import duckdb
import csv
import json
import sqlite3
import sys
import os
import difflib

MAX_RESULT_ROWS = 1000
MAX_COMPARE_MISMATCHES = 1000
TABLE_NAME = "parquet_data"
COMPARE_TABLE_NAME = "compare_data"
SCHEMA_ROOT_NAMES = ("schema", "root")

def sql_string(value):
    return "'" + value.replace("'", "''") + "'"

def normalize_query(query):
    if query is None or not query.strip():
        return f"SELECT * FROM {TABLE_NAME}"

    normalized = query.strip()
    while normalized.endswith(";"):
        normalized = normalized[:-1].strip()

    if not normalized:
        return f"SELECT * FROM {TABLE_NAME}"

    lower_query = normalized.lstrip().lower()
    if not (lower_query.startswith("select") or lower_query.startswith("with")):
        raise ValueError(
            f"Only SELECT queries are supported. Query this file as the {TABLE_NAME} table."
        )

    return normalized

def create_parquet_view(conn, file_path):
    parquet_path = sql_string(file_path)
    conn.execute(
        f"CREATE OR REPLACE TEMP VIEW {TABLE_NAME} AS "
        f"SELECT * FROM read_parquet({parquet_path})"
    )

def create_named_parquet_view(conn, table_name, file_path):
    parquet_path = sql_string(file_path)
    conn.execute(
        f"CREATE OR REPLACE TEMP VIEW {table_name} AS "
        f"SELECT * FROM read_parquet({parquet_path})"
    )

def convert_rows_to_json(columns, result):
    data = []
    for row in result:
        row_dict = {}
        for col_name, value in zip(columns, row):
            if value is None:
                row_dict[col_name] = None
            elif isinstance(value, (int, float, bool, str)):
                row_dict[col_name] = value
            else:
                row_dict[col_name] = str(value)
        data.append(row_dict)
    return data

def make_unique_column_names(columns):
    seen = {}
    unique_columns = []

    for column in columns:
        base_name = str(column) if column else "column"
        count = seen.get(base_name, 0)
        seen[base_name] = count + 1
        unique_columns.append(base_name if count == 0 else f"{base_name}_{count + 1}")

    return unique_columns

def serialize_export_value(value):
    if value is None or isinstance(value, (int, float, bool, str)):
        return value

    return str(value)

def serialize_compare_value(value):
    if value is None or isinstance(value, (int, float, bool, str)):
        return value

    return str(value)

def row_to_dict(columns, row):
    if row is None:
        return None

    return {
        column: serialize_compare_value(value)
        for column, value in zip(columns, row)
    }

def sqlite_identifier(value):
    return '"' + str(value).replace('"', '""') + '"'

def duckdb_identifier(value):
    return '"' + str(value).replace('"', '""') + '"'

def export_csv(cursor, columns, output_path):
    row_count = 0
    with open(output_path, "w", newline="", encoding="utf-8") as output_file:
        writer = csv.writer(output_file)
        writer.writerow(columns)

        while True:
            rows = cursor.fetchmany(1000)
            if not rows:
                break

            for row in rows:
                writer.writerow([serialize_export_value(value) for value in row])
                row_count += 1

    return row_count

def export_json(cursor, columns, output_path):
    row_count = 0
    first_row = True

    with open(output_path, "w", encoding="utf-8") as output_file:
        output_file.write("[\n")

        while True:
            rows = cursor.fetchmany(1000)
            if not rows:
                break

            for row in rows:
                if not first_row:
                    output_file.write(",\n")

                row_dict = {
                    column: serialize_export_value(value)
                    for column, value in zip(columns, row)
                }
                output_file.write(json.dumps(row_dict, ensure_ascii=False))
                first_row = False
                row_count += 1

        output_file.write("\n]\n")

    return row_count

def export_sqlite(cursor, columns, output_path):
    if os.path.exists(output_path):
        os.remove(output_path)

    unique_columns = make_unique_column_names(columns)
    row_count = 0
    sqlite_conn = sqlite3.connect(output_path)

    try:
        column_sql = ", ".join(f"{sqlite_identifier(column)}" for column in unique_columns)
        placeholders = ", ".join("?" for _ in unique_columns)
        sqlite_conn.execute(f"CREATE TABLE {sqlite_identifier(TABLE_NAME)} ({column_sql})")

        while True:
            rows = cursor.fetchmany(1000)
            if not rows:
                break

            serialized_rows = [
                [serialize_export_value(value) for value in row]
                for row in rows
            ]
            sqlite_conn.executemany(
                f"INSERT INTO {sqlite_identifier(TABLE_NAME)} VALUES ({placeholders})",
                serialized_rows
            )
            row_count += len(serialized_rows)

        sqlite_conn.commit()
    finally:
        sqlite_conn.close()

    return row_count

def safe_int(value):
    if value is None:
        return None

    try:
        return int(value)
    except (TypeError, ValueError):
        return None

def is_truthy_text(value):
    if value is None:
        return None

    text = str(value).lower()
    if "true" in text or "utc=true" in text:
        return True
    if "false" in text or "utc=false" in text:
        return False
    return None

def parse_timestamp_metadata(logical_type):
    if not logical_type:
        return {
            "unit": None,
            "isAdjustedToUTC": None,
            "timezoneInterpretation": None
        }

    logical_text = str(logical_type)
    lower_text = logical_text.lower()
    if "timestamp" not in lower_text and "time" not in lower_text:
        return {
            "unit": None,
            "isAdjustedToUTC": None,
            "timezoneInterpretation": None
        }

    unit = None
    for candidate in ("NANOS", "MICROS", "MILLIS"):
        if candidate.lower() in lower_text:
            unit = candidate
            break

    is_adjusted_to_utc = is_truthy_text(logical_text)
    if is_adjusted_to_utc is True:
        timezone_interpretation = "UTC normalized"
    elif is_adjusted_to_utc is False:
        timezone_interpretation = "Local or timezone-naive"
    else:
        timezone_interpretation = None

    return {
        "unit": unit,
        "isAdjustedToUTC": is_adjusted_to_utc,
        "timezoneInterpretation": timezone_interpretation
    }

def create_schema_node(row, path, parent_path, depth, definition_level, repetition_level):
    repetition_type = row.get("repetition_type")
    logical_type = row.get("logical_type") or row.get("converted_type")
    timestamp = parse_timestamp_metadata(logical_type)

    return {
        "name": row.get("name") or "",
        "path": path,
        "parentPath": parent_path,
        "depth": depth,
        "physicalType": row.get("type"),
        "logicalType": logical_type,
        "convertedType": row.get("converted_type"),
        "nullableStatus": "nullable" if repetition_type == "OPTIONAL" else "required" if repetition_type == "REQUIRED" else "repeated",
        "repetitionType": repetition_type,
        "repetitionLevel": repetition_level,
        "definitionLevel": definition_level,
        "decimalPrecision": safe_int(row.get("precision")),
        "decimalScale": safe_int(row.get("scale")),
        "timestampUnit": timestamp["unit"],
        "timestampTimezoneInterpretation": timestamp["timezoneInterpretation"],
        "timestampIsAdjustedToUTC": timestamp["isAdjustedToUTC"],
        "numChildren": safe_int(row.get("num_children")) or 0,
        "children": []
    }

def read_parquet_schema(conn, file_path):
    schema_query = f"SELECT * FROM parquet_schema({sql_string(file_path)})"
    schema_result = conn.execute(schema_query).fetchall()
    schema_columns = [desc[0] for desc in conn.description]
    schema_rows = [
        {column: value for column, value in zip(schema_columns, row)}
        for row in schema_result
    ]

    nodes = []
    stack = []

    for row in schema_rows:
        name = row.get("name") or ""
        num_children = safe_int(row.get("num_children")) or 0

        while stack and stack[-1]["remainingChildren"] == 0:
            stack.pop()

        parent = stack[-1] if stack else None
        is_root = parent is None and name.lower() in SCHEMA_ROOT_NAMES

        parent_parts = [] if parent is None else parent["pathParts"]
        path_parts = [] if is_root else parent_parts + [name]
        path = ".".join(path_parts) if path_parts else name
        parent_path = ".".join(parent_parts) if parent_parts else None

        inherited_definition = 0 if parent is None else parent["definitionLevel"]
        inherited_repetition = 0 if parent is None else parent["repetitionLevel"]
        repetition_type = row.get("repetition_type")
        definition_level = inherited_definition + (1 if repetition_type in ("OPTIONAL", "REPEATED") else 0)
        repetition_level = inherited_repetition + (1 if repetition_type == "REPEATED" else 0)

        node = create_schema_node(
            row,
            path,
            parent_path,
            len(path_parts),
            definition_level,
            repetition_level
        )
        nodes.append(node)

        if parent is not None:
            parent["node"]["children"].append(node)
            parent["remainingChildren"] -= 1

        if num_children > 0:
            stack.append({
                "node": node,
                "pathParts": path_parts,
                "remainingChildren": num_children,
                "definitionLevel": definition_level,
                "repetitionLevel": repetition_level
            })

    leaf_columns = [node for node in nodes if node["numChildren"] == 0]
    root_nodes = [node for node in nodes if node["parentPath"] is None]

    return {
        "columns": leaf_columns,
        "tree": root_nodes,
        "raw": schema_rows,
        "columnCount": len(leaf_columns)
    }

def get_first_value(row, keys, default=None):
    for key in keys:
        if key in row and row[key] is not None:
            return row[key]

    return default

def add_doctor_issue(report, level, category, message, recommendation=None):
    issue = {
        "category": category,
        "message": message
    }

    if recommendation:
        issue["recommendation"] = recommendation

    if level == "error":
        report["errors"].append(issue)
    elif level == "warning":
        report["warnings"].append(issue)
    else:
        report["passedChecks"].append(issue)

    if recommendation:
        report["recommendations"].append(recommendation)

def read_parquet_metadata(conn, file_path):
    metadata_result = conn.execute(f"SELECT * FROM parquet_metadata({sql_string(file_path)})").fetchall()
    metadata_columns = [desc[0] for desc in conn.description]
    return [
        {column: value for column, value in zip(metadata_columns, row)}
        for row in metadata_result
    ]

def get_row_group_id(row):
    return get_first_value(row, ["row_group_id", "row_group", "row_group_idx", "row_group_index"], 0)

def get_column_name_from_metadata(row):
    return get_first_value(row, ["path_in_schema", "column_name", "name", "column_path"], "unknown")

def analyze_file_integrity(conn, file_path, file_size, report):
    integrity = {
        "fileSize": file_size,
        "startsWithParquetMagic": False,
        "endsWithParquetMagic": False,
        "footerPresent": False,
        "duckdbReadable": False,
        "rowGroupsReadable": False
    }

    if file_size < 8:
        add_doctor_issue(
            report,
            "error",
            "File Integrity",
            "File is too small to be a valid Parquet file.",
            "Recreate the file from the source system and verify the write completed."
        )
        return integrity

    with open(file_path, "rb") as parquet_file:
        start_magic = parquet_file.read(4)
        parquet_file.seek(-4, os.SEEK_END)
        end_magic = parquet_file.read(4)

    integrity["startsWithParquetMagic"] = start_magic == b"PAR1"
    integrity["endsWithParquetMagic"] = end_magic == b"PAR1"
    integrity["footerPresent"] = integrity["endsWithParquetMagic"]

    if not integrity["startsWithParquetMagic"]:
        add_doctor_issue(
            report,
            "error",
            "File Integrity",
            "Invalid Parquet magic bytes at the start of the file.",
            "Confirm the file is Parquet and not a renamed CSV/JSON/binary file."
        )
    else:
        add_doctor_issue(report, "pass", "File Integrity", "Start magic bytes are valid.")

    if not integrity["endsWithParquetMagic"]:
        add_doctor_issue(
            report,
            "error",
            "File Integrity",
            "Missing or invalid Parquet footer magic bytes.",
            "The file may be truncated or an incomplete write. Re-export or rewrite the file."
        )
    else:
        add_doctor_issue(report, "pass", "File Integrity", "Footer magic bytes are valid.")

    try:
        conn.execute(f"SELECT COUNT(*) FROM read_parquet({sql_string(file_path)})").fetchone()
        integrity["duckdbReadable"] = True
        integrity["rowGroupsReadable"] = True
        add_doctor_issue(report, "pass", "File Integrity", "DuckDB can read the file and row groups.")
    except Exception as error:
        add_doctor_issue(
            report,
            "error",
            "File Integrity",
            f"DuckDB could not read the file or one of its row groups: {error}",
            "Rewrite the Parquet file or isolate the failing row group with a parquet repair/conversion tool."
        )

    return integrity

def analyze_schema_validation(schema, report):
    columns = []

    for column in schema.get("columns", []):
        issues = []
        logical_type = column.get("logicalType")
        physical_type = column.get("physicalType")

        if logical_type and "STRING" in str(logical_type).upper() and physical_type not in ("BYTE_ARRAY", "FIXED_LEN_BYTE_ARRAY"):
            issues.append("String logical type is not backed by a byte-array physical type.")

        if logical_type and "DECIMAL" in str(logical_type).upper():
            if column.get("decimalPrecision") is None or column.get("decimalScale") is None:
                issues.append("Decimal logical type is missing precision or scale.")

        if logical_type and "TIMESTAMP" in str(logical_type).upper() and not column.get("timestampUnit"):
            issues.append("Timestamp logical type does not expose a timestamp unit.")

        if physical_type in ("BYTE_ARRAY", "FIXED_LEN_BYTE_ARRAY") and not logical_type:
            issues.append("Byte-array column has no logical type annotation.")

        status = "warning" if issues else "pass"
        columns.append({
            "name": column.get("name"),
            "path": column.get("path"),
            "physicalType": physical_type,
            "logicalType": logical_type,
            "nullableStatus": column.get("nullableStatus"),
            "decimalPrecision": column.get("decimalPrecision"),
            "decimalScale": column.get("decimalScale"),
            "timestampUnit": column.get("timestampUnit"),
            "status": status,
            "issues": issues
        })

        for issue in issues:
            add_doctor_issue(
                report,
                "warning",
                "Schema Validation",
                f"{column.get('path')}: {issue}",
                "Review the writer schema and ensure logical annotations match the intended data semantics."
            )

    if not any(column["issues"] for column in columns):
        add_doctor_issue(report, "pass", "Schema Validation", "No suspicious physical/logical type mappings detected.")

    return {
        "columns": columns
    }

def analyze_row_groups(metadata_rows, report):
    grouped = {}
    for row in metadata_rows:
        row_group_id = get_row_group_id(row)
        grouped.setdefault(row_group_id, []).append(row)

    row_groups = []

    for row_group_id, rows in grouped.items():
        first_row = rows[0]
        row_count = safe_int(get_first_value(first_row, ["row_group_num_rows", "num_rows", "rows"], 0)) or 0
        compressed_size = sum(
            safe_int(get_first_value(row, ["total_compressed_size", "compressed_size"], 0)) or 0
            for row in rows
        )
        uncompressed_size = sum(
            safe_int(get_first_value(row, ["total_uncompressed_size", "uncompressed_size"], 0)) or 0
            for row in rows
        )
        compression_ratio = round(uncompressed_size / compressed_size, 3) if compressed_size else None
        issues = []

        if row_count == 0:
            issues.append("Row group is empty.")
        elif row_count < 100:
            issues.append("Row group is very small.")
        elif row_count > 1000000:
            issues.append("Row group is unusually large.")

        if compressed_size == 0 and row_count > 0:
            issues.append("Row group has no compressed-size metadata.")

        column_chunks = []
        for row in rows:
            column_chunks.append({
                "column": get_column_name_from_metadata(row),
                "compression": get_first_value(row, ["compression", "codec"]),
                "compressedSize": safe_int(get_first_value(row, ["total_compressed_size", "compressed_size"])),
                "uncompressedSize": safe_int(get_first_value(row, ["total_uncompressed_size", "uncompressed_size"])),
                "numValues": safe_int(get_first_value(row, ["num_values", "values"])),
                "encodings": get_first_value(row, ["encodings"])
            })

        row_group = {
            "id": row_group_id,
            "rowCount": row_count,
            "compressedSize": compressed_size,
            "uncompressedSize": uncompressed_size,
            "compressionRatio": compression_ratio,
            "columnChunks": column_chunks,
            "issues": issues
        }
        row_groups.append(row_group)

        for issue in issues:
            add_doctor_issue(
                report,
                "warning",
                "Row Group Analysis",
                f"Row group {row_group_id}: {issue}",
                "Rewrite the file with a balanced row group size for better scan performance."
            )

    if row_groups and not any(row_group["issues"] for row_group in row_groups):
        add_doctor_issue(report, "pass", "Row Group Analysis", "Row group sizes look healthy.")

    return {
        "rowGroups": row_groups
    }

def analyze_column_statistics(metadata_rows, report):
    grouped = {}
    for row in metadata_rows:
        column_name = get_column_name_from_metadata(row)
        grouped.setdefault(column_name, []).append(row)

    columns = []

    for column_name, rows in grouped.items():
        min_values = [get_first_value(row, ["stats_min", "stats_min_value", "min"]) for row in rows]
        max_values = [get_first_value(row, ["stats_max", "stats_max_value", "max"]) for row in rows]
        null_counts = [safe_int(get_first_value(row, ["stats_null_count", "null_count"])) for row in rows]
        distinct_counts = [safe_int(get_first_value(row, ["stats_distinct_count", "distinct_count"])) for row in rows]
        value_counts = [safe_int(get_first_value(row, ["num_values", "values"])) for row in rows]

        has_min_max = any(value is not None for value in min_values) and any(value is not None for value in max_values)
        has_null_count = any(value is not None for value in null_counts)
        has_distinct_count = any(value is not None for value in distinct_counts)
        total_nulls = sum(value for value in null_counts if value is not None)
        total_values = sum(value for value in value_counts if value is not None)
        non_null_values = total_values - total_nulls if total_values else None
        non_null_mins = [value for value in min_values if value is not None]
        non_null_maxes = [value for value in max_values if value is not None]
        all_null = total_values > 0 and has_null_count and total_nulls >= total_values
        constant_value = bool(non_null_mins and non_null_maxes and set(map(str, non_null_mins)) == set(map(str, non_null_maxes)) and non_null_values and non_null_values > 0)
        issues = []

        if not has_min_max and not has_null_count and not has_distinct_count:
            issues.append("Statistics are missing.")
        elif not has_min_max:
            issues.append("Minimum/maximum statistics are missing.")

        if not has_null_count:
            issues.append("Null-count statistics are missing.")

        if all_null:
            issues.append("Column appears to contain only null values.")

        if constant_value:
            issues.append("Column appears to contain one constant value.")

        column_result = {
            "column": column_name,
            "hasMinMax": has_min_max,
            "hasNullCount": has_null_count,
            "hasDistinctCount": has_distinct_count,
            "nullCount": total_nulls if has_null_count else None,
            "distinctCount": sum(value for value in distinct_counts if value is not None) if has_distinct_count else None,
            "allNull": all_null,
            "constantValue": constant_value,
            "issues": issues
        }
        columns.append(column_result)

        for issue in issues:
            add_doctor_issue(
                report,
                "warning",
                "Column Statistics",
                f"{column_name}: {issue}",
                "Regenerate the Parquet file with statistics enabled and remove unused constant/all-null columns when possible."
            )

    if columns and not any(column["issues"] for column in columns):
        add_doctor_issue(report, "pass", "Column Statistics", "Column statistics are present and look useful.")

    return {
        "columns": columns
    }

def is_text_type(duckdb_type):
    return any(token in str(duckdb_type or "").upper() for token in ("CHAR", "VARCHAR", "STRING", "TEXT"))

def is_numeric_type(duckdb_type):
    return any(token in str(duckdb_type or "").upper() for token in ("INT", "DECIMAL", "DOUBLE", "FLOAT", "REAL", "NUMERIC"))

def is_temporal_type(duckdb_type):
    return any(token in str(duckdb_type or "").upper() for token in ("DATE", "TIME", "TIMESTAMP"))

def safe_scalar(conn, query, default=None):
    try:
        return conn.execute(query).fetchone()[0]
    except Exception as error:
        print(f"DEBUG: Diagnostic query failed: {error}. Query: {query}", file=sys.stderr)
        return default

def analyze_data_quality(conn, report):
    describe_rows = conn.execute(f"DESCRIBE SELECT * FROM {TABLE_NAME}").fetchall()
    columns = [{"name": row[0], "duckdbType": row[1]} for row in describe_rows]
    total_rows = safe_scalar(conn, f"SELECT COUNT(*) FROM {TABLE_NAME}", 0) or 0
    distinct_rows = safe_scalar(conn, f"SELECT COUNT(*) FROM (SELECT DISTINCT * FROM {TABLE_NAME}) AS distinct_rows", total_rows)
    duplicate_rows_estimate = max(0, total_rows - (distinct_rows or 0))
    column_results = []

    if duplicate_rows_estimate > 0:
        add_doctor_issue(
            report,
            "warning",
            "Data Quality Validation",
            f"Detected approximately {duplicate_rows_estimate} duplicate rows.",
            "Confirm whether duplicate rows are expected; otherwise deduplicate before publishing the dataset."
        )

    for column in columns:
        name = column["name"]
        column_ref = duckdb_identifier(name)
        duckdb_type = column["duckdbType"]
        null_count = safe_scalar(
            conn,
            f"SELECT SUM(CASE WHEN {column_ref} IS NULL THEN 1 ELSE 0 END) FROM {TABLE_NAME}",
            0
        ) or 0
        null_ratio = round(null_count / total_rows, 4) if total_rows else 0
        issues = []
        metrics = {
            "nullCount": null_count,
            "nullRatio": null_ratio
        }

        if total_rows and null_ratio >= 0.5:
            issues.append("High null ratio.")

        if is_text_type(duckdb_type):
            empty_count = safe_scalar(
                conn,
                f"SELECT SUM(CASE WHEN {column_ref} = '' THEN 1 ELSE 0 END) FROM {TABLE_NAME}",
                0
            ) or 0
            default_count = safe_scalar(
                conn,
                "SELECT SUM(CASE WHEN lower(trim(CAST({0} AS VARCHAR))) IN "
                "('unknown', 'n/a', 'na', 'null', 'none', '0') THEN 1 ELSE 0 END) "
                "FROM {1}".format(column_ref, TABLE_NAME),
                0
            ) or 0
            metrics["emptyStringCount"] = empty_count
            metrics["suspiciousDefaultCount"] = default_count
            if empty_count > 0:
                issues.append("Contains empty strings.")
            if total_rows and default_count / total_rows >= 0.1:
                issues.append("Suspicious default-like values are common.")

        if is_numeric_type(duckdb_type):
            min_value = safe_scalar(conn, f"SELECT MIN({column_ref}) FROM {TABLE_NAME}")
            max_value = safe_scalar(conn, f"SELECT MAX({column_ref}) FROM {TABLE_NAME}")
            metrics["min"] = serialize_compare_value(min_value)
            metrics["max"] = serialize_compare_value(max_value)
            if min_value == 0 and max_value == 0 and total_rows > 0 and null_count < total_rows:
                issues.append("All non-null numeric values are zero.")

        if is_temporal_type(duckdb_type):
            min_value = safe_scalar(conn, f"SELECT MIN({column_ref}) FROM {TABLE_NAME}")
            max_value = safe_scalar(conn, f"SELECT MAX({column_ref}) FROM {TABLE_NAME}")
            metrics["min"] = serialize_compare_value(min_value)
            metrics["max"] = serialize_compare_value(max_value)
            if min_value is not None and (str(min_value) < "1900-01-01" or str(min_value) > "2200-01-01"):
                issues.append("Minimum date/time is outside the expected modern range.")
            if max_value is not None and (str(max_value) < "1900-01-01" or str(max_value) > "2200-01-01"):
                issues.append("Maximum date/time is outside the expected modern range.")

        column_results.append({
            "column": name,
            "duckdbType": duckdb_type,
            "issues": issues,
            **metrics
        })

        for issue in issues:
            add_doctor_issue(
                report,
                "warning",
                "Data Quality Validation",
                f"{name}: {issue}",
                "Profile the source data and add validation rules for nulls, defaults, ranges, and empty strings."
            )

    if duplicate_rows_estimate == 0 and not any(column["issues"] for column in column_results):
        add_doctor_issue(report, "pass", "Data Quality Validation", "No duplicate rows, high-null columns, or suspicious defaults detected.")

    return {
        "totalRows": total_rows,
        "distinctRows": distinct_rows,
        "duplicateRowsEstimate": duplicate_rows_estimate,
        "columns": column_results
    }

def analyze_decimal_timestamp_diagnostics(schema, report):
    columns = []

    for column in schema.get("columns", []):
        issues = []
        physical_type = column.get("physicalType")
        logical_type = column.get("logicalType")
        precision = column.get("decimalPrecision")
        scale = column.get("decimalScale")
        timestamp_unit = column.get("timestampUnit")
        timezone = column.get("timestampTimezoneInterpretation")

        if logical_type and "DECIMAL" in str(logical_type).upper():
            if precision is None or scale is None:
                issues.append("Decimal annotation is missing precision or scale.")
            elif scale > precision:
                issues.append("Decimal scale is greater than precision.")
            elif precision > 18:
                issues.append("High precision decimal may need careful downstream handling.")

        if physical_type in ("FLOAT", "DOUBLE") and not (logical_type and "DECIMAL" in str(logical_type).upper()):
            issues.append("Floating-point physical type can introduce rounding risk for exact values.")

        if logical_type and "TIMESTAMP" in str(logical_type).upper():
            if not timestamp_unit:
                issues.append("Timestamp unit is missing.")
            if not timezone:
                issues.append("Timestamp timezone interpretation is ambiguous.")

        if issues:
            columns.append({
                "column": column.get("path") or column.get("name"),
                "physicalType": physical_type,
                "logicalType": logical_type,
                "decimalPrecision": precision,
                "decimalScale": scale,
                "timestampUnit": timestamp_unit,
                "timezoneInterpretation": timezone,
                "issues": issues
            })

            for issue in issues:
                add_doctor_issue(
                    report,
                    "warning",
                    "Decimal and Timestamp Diagnostics",
                    f"{column.get('path')}: {issue}",
                    "Confirm decimal precision/scale and timestamp timezone semantics with the source contract."
                )

    if not columns:
        add_doctor_issue(report, "pass", "Decimal and Timestamp Diagnostics", "Decimal and timestamp annotations look consistent.")

    return {
        "columns": columns
    }

def has_dictionary_encoding(encodings):
    text = str(encodings or "").upper()
    return "DICTIONARY" in text

def analyze_compression_encoding(metadata_rows, report):
    grouped = {}
    for row in metadata_rows:
        grouped.setdefault(get_column_name_from_metadata(row), []).append(row)

    columns = []
    for column_name, rows in grouped.items():
        compressed_size = sum(safe_int(get_first_value(row, ["total_compressed_size", "compressed_size"], 0)) or 0 for row in rows)
        uncompressed_size = sum(safe_int(get_first_value(row, ["total_uncompressed_size", "uncompressed_size"], 0)) or 0 for row in rows)
        total_values = sum(safe_int(get_first_value(row, ["num_values", "values"], 0)) or 0 for row in rows)
        distinct_count = sum(safe_int(get_first_value(row, ["stats_distinct_count", "distinct_count"], 0)) or 0 for row in rows)
        encodings = ", ".join(str(get_first_value(row, ["encodings"], "")) for row in rows if get_first_value(row, ["encodings"], ""))
        compression = ", ".join(sorted(set(str(get_first_value(row, ["compression", "codec"], "")) for row in rows if get_first_value(row, ["compression", "codec"], ""))))
        compression_ratio = round(uncompressed_size / compressed_size, 3) if compressed_size else None
        cardinality_ratio = round(distinct_count / total_values, 4) if distinct_count and total_values else None
        issues = []

        if compressed_size == 0 and uncompressed_size > 0:
            issues.append("Compressed size metadata is missing.")
        elif compression_ratio is not None and compression_ratio < 1.1 and uncompressed_size > 1024 * 1024:
            issues.append("Compression efficiency is low.")

        if compression.upper() in ("", "UNCOMPRESSED"):
            issues.append("Column appears to be uncompressed.")

        if cardinality_ratio is not None and cardinality_ratio < 0.1 and not has_dictionary_encoding(encodings):
            issues.append("Low-cardinality column may benefit from dictionary encoding.")
        elif cardinality_ratio is not None and cardinality_ratio > 0.8 and has_dictionary_encoding(encodings):
            issues.append("Dictionary encoding may not help this high-cardinality column.")

        column_result = {
            "column": column_name,
            "compression": compression or None,
            "encodings": encodings or None,
            "compressedSize": compressed_size,
            "uncompressedSize": uncompressed_size,
            "compressionRatio": compression_ratio,
            "cardinalityRatio": cardinality_ratio,
            "issues": issues
        }
        columns.append(column_result)

        for issue in issues:
            add_doctor_issue(
                report,
                "warning",
                "Compression and Encoding Analysis",
                f"{column_name}: {issue}",
                "Review writer compression and dictionary settings for this column."
            )

    if columns and not any(column["issues"] for column in columns):
        add_doctor_issue(report, "pass", "Compression and Encoding Analysis", "Column compression and encoding metadata look healthy.")

    return {
        "columns": columns
    }

def build_health_report(report):
    score = 100
    score -= len(report["errors"]) * 25
    report["healthScore"] = max(0, min(100, score))
    report["recommendations"] = list(dict.fromkeys(report["recommendations"]))
    return report

def analyze_parquet_doctor(conn, file_path, schema, file_size):
    report = {
        "healthScore": 100,
        "errors": [],
        "warnings": [],
        "passedChecks": [],
        "recommendations": []
    }

    integrity = analyze_file_integrity(conn, file_path, file_size, report)
    schema_validation = analyze_schema_validation(schema, report)
    decimal_timestamp_diagnostics = analyze_decimal_timestamp_diagnostics(schema, report)

    try:
        data_quality = analyze_data_quality(conn, report)
    except Exception as error:
        add_doctor_issue(
            report,
            "warning",
            "Data Quality Validation",
            f"Could not run data quality checks: {error}",
            "Try running the diagnostics again after confirming the file can be fully scanned."
        )
        data_quality = {"totalRows": 0, "distinctRows": 0, "duplicateRowsEstimate": 0, "columns": []}

    try:
        metadata_rows = read_parquet_metadata(conn, file_path)
        row_groups = analyze_row_groups(metadata_rows, report)
        column_statistics = analyze_column_statistics(metadata_rows, report)
        compression_encoding = analyze_compression_encoding(metadata_rows, report)
    except Exception as error:
        add_doctor_issue(
            report,
            "warning",
            "Parquet Metadata",
            f"Could not read full Parquet metadata: {error}",
            "Try rewriting the file with a current Parquet writer and metadata/statistics enabled."
        )
        row_groups = {"rowGroups": []}
        column_statistics = {"columns": []}
        compression_encoding = {"columns": []}

    return {
        "healthReport": build_health_report(report),
        "integrity": integrity,
        "schemaValidation": schema_validation,
        "rowGroupAnalysis": row_groups,
        "columnStatistics": column_statistics,
        "dataQuality": data_quality,
        "decimalTimestampDiagnostics": decimal_timestamp_diagnostics,
        "compressionEncodingAnalysis": compression_encoding
    }

def analyze_failed_parquet_doctor(file_path, file_size, error):
    report = {
        "healthScore": 0,
        "errors": [],
        "warnings": [],
        "passedChecks": [],
        "recommendations": []
    }
    integrity = {
        "fileSize": file_size,
        "startsWithParquetMagic": False,
        "endsWithParquetMagic": False,
        "footerPresent": False,
        "duckdbReadable": False,
        "rowGroupsReadable": False
    }

    try:
        if file_size >= 8:
            with open(file_path, "rb") as parquet_file:
                start_magic = parquet_file.read(4)
                parquet_file.seek(-4, os.SEEK_END)
                end_magic = parquet_file.read(4)
            integrity["startsWithParquetMagic"] = start_magic == b"PAR1"
            integrity["endsWithParquetMagic"] = end_magic == b"PAR1"
            integrity["footerPresent"] = integrity["endsWithParquetMagic"]
    except Exception as magic_error:
        add_doctor_issue(
            report,
            "error",
            "File Integrity",
            f"Could not inspect Parquet magic bytes: {magic_error}",
            "Verify the file is accessible and rewrite it from the source system."
        )

    if not integrity["startsWithParquetMagic"]:
        add_doctor_issue(
            report,
            "error",
            "File Integrity",
            "Invalid or missing Parquet magic bytes at the start of the file.",
            "Confirm the file is a valid Parquet file."
        )

    if not integrity["endsWithParquetMagic"]:
        add_doctor_issue(
            report,
            "error",
            "File Integrity",
            "Missing or invalid Parquet footer magic bytes.",
            "The file may be truncated or an incomplete write. Re-export or rewrite the file."
        )

    add_doctor_issue(
        report,
        "error",
        "File Integrity",
        f"DuckDB could not read the file: {error}",
        "Rewrite the Parquet file or regenerate it with a compatible Parquet writer."
    )

    return {
        "healthReport": build_health_report(report),
        "integrity": integrity,
        "schemaValidation": {"columns": []},
        "rowGroupAnalysis": {"rowGroups": []},
        "columnStatistics": {"columns": []},
        "dataQuality": {"totalRows": 0, "distinctRows": 0, "duplicateRowsEstimate": 0, "columns": []},
        "decimalTimestampDiagnostics": {"columns": []},
        "compressionEncodingAnalysis": {"columns": []}
    }

def type_signature(column):
    return "|".join([
        str(column.get("duckdbType") or ""),
        str(column.get("physicalType") or ""),
        str(column.get("logicalType") or ""),
        str(column.get("decimalPrecision") or ""),
        str(column.get("decimalScale") or ""),
        str(column.get("timestampUnit") or "")
    ])

def read_compare_columns(conn, file_path):
    create_named_parquet_view(conn, TABLE_NAME, file_path)
    schema = read_parquet_schema(conn, file_path)
    schema_by_name = {
        column["name"]: column
        for column in schema.get("columns", [])
    }

    describe_rows = conn.execute(f"DESCRIBE SELECT * FROM {TABLE_NAME}").fetchall()
    columns = []

    for row in describe_rows:
        name = row[0]
        duckdb_type = row[1]
        schema_column = schema_by_name.get(name, {})
        column = {
            "name": name,
            "path": schema_column.get("path") or name,
            "duckdbType": duckdb_type,
            "physicalType": schema_column.get("physicalType"),
            "logicalType": schema_column.get("logicalType"),
            "nullableStatus": schema_column.get("nullableStatus"),
            "decimalPrecision": schema_column.get("decimalPrecision"),
            "decimalScale": schema_column.get("decimalScale"),
            "timestampUnit": schema_column.get("timestampUnit")
        }
        column["typeSignature"] = type_signature(column)
        columns.append(column)

    return columns

def get_compare_metadata(base_path, compare_path):
    if not os.path.exists(base_path):
        return {
            "success": False,
            "error": f"Base file does not exist: {base_path}"
        }

    if not os.path.exists(compare_path):
        return {
            "success": False,
            "error": f"Compare file does not exist: {compare_path}"
        }

    base_conn = None
    compare_conn = None

    try:
        base_conn = duckdb.connect()
        compare_conn = duckdb.connect()
        base_columns = read_compare_columns(base_conn, base_path)
        compare_columns = read_compare_columns(compare_conn, compare_path)

        base_conn.close()
        compare_conn.close()

        return {
            "success": True,
            "basePath": base_path,
            "comparePath": compare_path,
            "baseColumns": base_columns,
            "compareColumns": compare_columns
        }

    except Exception as e:
        if base_conn is not None:
            base_conn.close()
        if compare_conn is not None:
            compare_conn.close()

        import traceback
        print(f"DEBUG: Error reading compare metadata: {str(e)}", file=sys.stderr)
        print(f"DEBUG: Traceback: {traceback.format_exc()}", file=sys.stderr)

        return {
            "success": False,
            "basePath": base_path,
            "comparePath": compare_path,
            "error": str(e),
            "traceback": traceback.format_exc()
        }

def column_lookup(columns):
    return {column["name"]: column for column in columns}

def summarize_column(column):
    return {
        "name": column.get("name"),
        "path": column.get("path"),
        "duckdbType": column.get("duckdbType"),
        "physicalType": column.get("physicalType"),
        "logicalType": column.get("logicalType"),
        "nullableStatus": column.get("nullableStatus"),
        "decimalPrecision": column.get("decimalPrecision"),
        "decimalScale": column.get("decimalScale"),
        "timestampUnit": column.get("timestampUnit"),
        "typeSignature": column.get("typeSignature")
    }

def schema_signature(columns):
    return json.dumps(
        [
            {
                "name": column.get("name"),
                "path": column.get("path"),
                "typeSignature": column.get("typeSignature")
            }
            for column in columns
        ],
        sort_keys=True
    )

def detect_schema_drift(current_path, reference_path):
    if not os.path.exists(current_path):
        return {"success": False, "error": f"Current file does not exist: {current_path}"}

    if not os.path.exists(reference_path):
        return {"success": False, "error": f"Reference file does not exist: {reference_path}"}

    current_conn = None
    reference_conn = None

    try:
        current_conn = duckdb.connect()
        reference_conn = duckdb.connect()
        current_columns = read_compare_columns(current_conn, current_path)
        reference_columns = read_compare_columns(reference_conn, reference_path)

        current_by_name = column_lookup(current_columns)
        reference_by_name = column_lookup(reference_columns)
        current_names = set(current_by_name.keys())
        reference_names = set(reference_by_name.keys())
        added_names = sorted(current_names - reference_names)
        removed_names = sorted(reference_names - current_names)
        shared_names = sorted(current_names & reference_names)

        type_changed = []
        for name in shared_names:
            current_column = current_by_name[name]
            reference_column = reference_by_name[name]
            if current_column.get("typeSignature") != reference_column.get("typeSignature"):
                type_changed.append({
                    "column": name,
                    "current": summarize_column(current_column),
                    "reference": summarize_column(reference_column)
                })

        rename_candidates = []
        for removed_name in removed_names:
            reference_column = reference_by_name[removed_name]
            for added_name in added_names:
                current_column = current_by_name[added_name]
                if reference_column.get("typeSignature") != current_column.get("typeSignature"):
                    continue

                similarity = difflib.SequenceMatcher(
                    None,
                    removed_name.lower(),
                    added_name.lower()
                ).ratio()
                if similarity >= 0.62:
                    rename_candidates.append({
                        "referenceColumn": removed_name,
                        "currentColumn": added_name,
                        "similarity": round(similarity, 3),
                        "typeSignature": current_column.get("typeSignature")
                    })

        current_conn.close()
        reference_conn.close()
        current_conn = None
        reference_conn = None

        return {
            "success": True,
            "currentPath": current_path,
            "referencePath": reference_path,
            "addedColumns": [summarize_column(current_by_name[name]) for name in added_names],
            "removedColumns": [summarize_column(reference_by_name[name]) for name in removed_names],
            "typeChangedColumns": type_changed,
            "renameCandidates": rename_candidates,
            "summary": {
                "currentColumnCount": len(current_columns),
                "referenceColumnCount": len(reference_columns),
                "added": len(added_names),
                "removed": len(removed_names),
                "typeChanged": len(type_changed),
                "renameCandidates": len(rename_candidates)
            }
        }

    except Exception as e:
        if current_conn is not None:
            current_conn.close()
        if reference_conn is not None:
            reference_conn.close()

        import traceback
        return {
            "success": False,
            "currentPath": current_path,
            "referencePath": reference_path,
            "error": str(e),
            "traceback": traceback.format_exc()
        }

def extract_partition_values(root_path, file_path):
    relative_dir = os.path.relpath(os.path.dirname(file_path), root_path)
    if relative_dir == ".":
        return {}

    partitions = {}
    for part in relative_dir.split(os.sep):
        if "=" in part:
            key, value = part.split("=", 1)
            if key:
                partitions[key] = value

    return partitions

def scan_single_parquet_file(root_path, file_path):
    file_size = os.path.getsize(file_path)
    conn = duckdb.connect()

    try:
        columns = read_compare_columns(conn, file_path)
        row_count = safe_scalar(conn, f"SELECT COUNT(*) FROM {TABLE_NAME}", 0) or 0
        conn.close()

        return {
            "path": file_path,
            "relativePath": os.path.relpath(file_path, root_path),
            "fileSize": file_size,
            "rowCount": row_count,
            "partitionValues": extract_partition_values(root_path, file_path),
            "schemaSignature": schema_signature(columns),
            "columns": [summarize_column(column) for column in columns],
            "error": None
        }
    except Exception as error:
        conn.close()
        return {
            "path": file_path,
            "relativePath": os.path.relpath(file_path, root_path),
            "fileSize": file_size,
            "rowCount": None,
            "partitionValues": extract_partition_values(root_path, file_path),
            "schemaSignature": None,
            "columns": [],
            "error": str(error)
        }

def analyze_dataset_partitions(folder_path):
    if not os.path.isdir(folder_path):
        return {"success": False, "error": f"Dataset folder does not exist: {folder_path}"}

    parquet_files = []
    for current_root, _, files in os.walk(folder_path):
        for filename in files:
            if filename.lower().endswith(".parquet"):
                parquet_files.append(os.path.join(current_root, filename))

    parquet_files.sort()

    if not parquet_files:
        return {
            "success": False,
            "folderPath": folder_path,
            "error": "No .parquet files found in the selected folder."
        }

    files = [scan_single_parquet_file(folder_path, parquet_file) for parquet_file in parquet_files]
    schema_groups = {}
    for file_info in files:
        signature = file_info.get("schemaSignature") or "unreadable"
        schema_groups.setdefault(signature, {
            "signature": signature,
            "fileCount": 0,
            "sampleFile": file_info.get("relativePath"),
            "columns": file_info.get("columns", [])
        })
        schema_groups[signature]["fileCount"] += 1

    all_partition_keys = sorted({
        key
        for file_info in files
        for key in file_info.get("partitionValues", {}).keys()
    })
    missing_partitions = []
    for file_info in files:
        missing_keys = [
            key
            for key in all_partition_keys
            if key not in file_info.get("partitionValues", {})
        ]
        if missing_keys:
            missing_partitions.append({
                "file": file_info.get("relativePath"),
                "missingKeys": missing_keys
            })

    small_file_threshold = 10 * 1024 * 1024
    small_files = [
        {
            "file": file_info.get("relativePath"),
            "fileSize": file_info.get("fileSize"),
            "rowCount": file_info.get("rowCount")
        }
        for file_info in files
        if file_info.get("fileSize", 0) > 0 and file_info.get("fileSize", 0) < small_file_threshold
    ]
    empty_files = [
        {
            "file": file_info.get("relativePath"),
            "fileSize": file_info.get("fileSize"),
            "rowCount": file_info.get("rowCount")
        }
        for file_info in files
        if file_info.get("fileSize", 0) == 0 or file_info.get("rowCount") == 0
    ]
    unreadable_files = [
        {
            "file": file_info.get("relativePath"),
            "error": file_info.get("error")
        }
        for file_info in files
        if file_info.get("error")
    ]

    partition_sizes = {}
    for file_info in files:
        partition = os.path.dirname(file_info.get("relativePath")) or "."
        partition_sizes.setdefault(partition, {"partition": partition, "fileCount": 0, "totalSize": 0, "rowCount": 0})
        partition_sizes[partition]["fileCount"] += 1
        partition_sizes[partition]["totalSize"] += file_info.get("fileSize") or 0
        partition_sizes[partition]["rowCount"] += file_info.get("rowCount") or 0

    size_values = [value["totalSize"] for value in partition_sizes.values() if value["totalSize"] > 0]
    uneven_partition_sizes = None
    if len(size_values) > 1 and min(size_values) > 0 and max(size_values) / min(size_values) >= 10:
        uneven_partition_sizes = {
            "smallestPartitionSize": min(size_values),
            "largestPartitionSize": max(size_values),
            "ratio": round(max(size_values) / min(size_values), 3)
        }

    warnings = []
    recommendations = []
    if len(schema_groups) > 1:
        warnings.append("Dataset contains inconsistent schemas.")
        recommendations.append("Rewrite or migrate files so all partitions share the same schema.")
    if missing_partitions:
        warnings.append("Some files are missing partition keys present elsewhere in the dataset.")
        recommendations.append("Normalize folder partition paths such as key=value for every partitioned file.")
    if empty_files:
        warnings.append("Dataset contains empty files.")
        recommendations.append("Remove empty files or regenerate failed output partitions.")
    if small_files:
        warnings.append("Dataset contains small files under 10 MB.")
        recommendations.append("Compact small files into larger Parquet files for better scan performance.")
    if uneven_partition_sizes:
        warnings.append("Partition sizes are uneven.")
        recommendations.append("Rebalance partitioning keys or compact oversized partitions.")
    if unreadable_files:
        warnings.append("Some Parquet files could not be read.")
        recommendations.append("Repair or remove unreadable files before publishing the dataset.")

    return {
        "success": True,
        "folderPath": folder_path,
        "fileCount": len(files),
        "totalSize": sum(file_info.get("fileSize") or 0 for file_info in files),
        "totalRows": sum(file_info.get("rowCount") or 0 for file_info in files),
        "schemaGroups": list(schema_groups.values()),
        "partitionKeys": all_partition_keys,
        "partitionSizes": sorted(partition_sizes.values(), key=lambda item: item["partition"]),
        "missingPartitions": missing_partitions,
        "smallFiles": small_files,
        "emptyFiles": empty_files,
        "unreadableFiles": unreadable_files,
        "unevenPartitionSizes": uneven_partition_sizes,
        "warnings": warnings,
        "recommendations": list(dict.fromkeys(recommendations))
    }

def read_parquet_file(file_path, user_query=None):
    """
    Read parquet file and return data as JSON
    """
    print(f"DEBUG: Starting to read parquet file: {file_path}", file=sys.stderr)
    print(f"DEBUG: File exists: {os.path.exists(file_path)}", file=sys.stderr)
    
    if not os.path.exists(file_path):
        return {
            'success': False,
            'error': f"File does not exist: {file_path}"
        }
    
    file_size = 0
    conn = None

    try:
        # Get file info
        file_size = os.path.getsize(file_path)
        print(f"DEBUG: File size: {file_size} bytes", file=sys.stderr)
        
        # Connect to DuckDB
        conn = duckdb.connect()
        print("DEBUG: DuckDB connected successfully", file=sys.stderr)

        create_parquet_view(conn, file_path)
        schema = read_parquet_schema(conn, file_path)
        doctor = analyze_parquet_doctor(conn, file_path, schema, file_size)
        query = normalize_query(user_query)
        
        # Read data with limit
        limited_query = f"SELECT * FROM ({query}) AS query_result LIMIT {MAX_RESULT_ROWS + 1}"
        print(f"DEBUG: Executing query: {query}", file=sys.stderr)
        
        result = conn.execute(limited_query).fetchall()
        columns = [desc[0] for desc in conn.description]
        result_limited = len(result) > MAX_RESULT_ROWS
        if result_limited:
            result = result[:MAX_RESULT_ROWS]

        try:
            total_rows = conn.execute(
                f"SELECT COUNT(*) FROM ({query}) AS query_result"
            ).fetchone()[0]
        except Exception as count_error:
            print(f"DEBUG: Could not count query rows: {str(count_error)}", file=sys.stderr)
            total_rows = len(result)
        
        print(f"DEBUG: Retrieved {len(result)} rows, {len(columns)} columns", file=sys.stderr)
        print(f"DEBUG: Columns: {columns}", file=sys.stderr)
        
        # Convert to JSON-serializable format
        data = convert_rows_to_json(columns, result)
        
        conn.close()
        conn = None
        
        return {
            'success': True,
            'data': data,
            'columns': columns,
            'rowCount': len(data),
            'totalRows': total_rows,
            'query': query,
            'resultLimited': result_limited,
            'schema': schema,
            'doctor': doctor,
            'debug': {
                'file_path': file_path,
                'file_size': file_size,
                'columns_count': len(columns),
                'rows_returned': len(data),
                'result_limited': result_limited
            }
        }
        
    except Exception as e:
        if conn is not None:
            conn.close()

        import traceback
        print(f"DEBUG: Error reading parquet file: {str(e)}", file=sys.stderr)
        print(f"DEBUG: Traceback: {traceback.format_exc()}", file=sys.stderr)
        
        return {
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc(),
            'query': user_query,
            'doctor': analyze_failed_parquet_doctor(file_path, file_size, str(e)),
            'debug': {
                'file_path': file_path,
                'file_exists': True,
                'file_size': file_size
            }
        }

def export_parquet_file(file_path, output_path, export_format, user_query=None):
    print(f"DEBUG: Starting export for parquet file: {file_path}", file=sys.stderr)
    print(f"DEBUG: Export format: {export_format}", file=sys.stderr)
    print(f"DEBUG: Export output: {output_path}", file=sys.stderr)

    if export_format not in ("csv", "json", "sqlite"):
        return {
            "success": False,
            "error": f"Unsupported export format: {export_format}"
        }

    if not os.path.exists(file_path):
        return {
            "success": False,
            "error": f"File does not exist: {file_path}"
        }

    conn = None

    try:
        conn = duckdb.connect()
        create_parquet_view(conn, file_path)
        query = normalize_query(user_query)
        cursor = conn.execute(query)
        columns = [desc[0] for desc in conn.description]

        if export_format == "csv":
            rows_exported = export_csv(cursor, columns, output_path)
        elif export_format == "json":
            rows_exported = export_json(cursor, make_unique_column_names(columns), output_path)
        else:
            rows_exported = export_sqlite(cursor, columns, output_path)

        conn.close()
        conn = None

        return {
            "success": True,
            "format": export_format,
            "outputPath": output_path,
            "rowsExported": rows_exported,
            "query": query
        }

    except Exception as e:
        if conn is not None:
            conn.close()

        import traceback
        print(f"DEBUG: Error exporting parquet file: {str(e)}", file=sys.stderr)
        print(f"DEBUG: Traceback: {traceback.format_exc()}", file=sys.stderr)

        return {
            "success": False,
            "format": export_format,
            "outputPath": output_path,
            "error": str(e),
            "traceback": traceback.format_exc(),
            "query": user_query
        }

def normalize_compare_mappings(base_columns, compare_columns, mappings):
    base_by_name = {column["name"]: column for column in base_columns}
    compare_by_name = {column["name"]: column for column in compare_columns}

    if mappings is None:
        base_names = [column["name"] for column in base_columns]
        compare_names = [column["name"] for column in compare_columns]

        if base_names != compare_names:
            return {
                "success": False,
                "error": "Only Parquet files with the same columns in the same order can be compared.",
                "baseColumns": base_names,
                "compareColumns": compare_names
            }

        mappings = [
            {"baseColumn": column_name, "compareColumn": column_name}
            for column_name in base_names
        ]

    if not mappings:
        return {
            "success": False,
            "error": "Select at least one column mapping before comparing."
        }

    normalized = []
    used_base_columns = set()
    used_compare_columns = set()

    for mapping in mappings:
        base_name = mapping.get("baseColumn")
        compare_name = mapping.get("compareColumn")

        if base_name not in base_by_name:
            return {
                "success": False,
                "error": f"Base column not found: {base_name}"
            }

        if compare_name not in compare_by_name:
            return {
                "success": False,
                "error": f"Compare column not found: {compare_name}"
            }

        if base_name in used_base_columns:
            return {
                "success": False,
                "error": f"Base column mapped more than once: {base_name}"
            }

        if compare_name in used_compare_columns:
            return {
                "success": False,
                "error": f"Compare column mapped more than once: {compare_name}"
            }

        base_column = base_by_name[base_name]
        compare_column = compare_by_name[compare_name]

        if base_column["typeSignature"] != compare_column["typeSignature"]:
            return {
                "success": False,
                "error": f"Type mismatch for mapping {base_name} -> {compare_name}. Both columns must have the same type.",
                "baseColumn": base_column,
                "compareColumn": compare_column
            }

        used_base_columns.add(base_name)
        used_compare_columns.add(compare_name)
        normalized.append({
            "baseColumn": base_name,
            "compareColumn": compare_name,
            "displayColumn": base_name if base_name == compare_name else f"{base_name} -> {compare_name}"
        })

    return {
        "success": True,
        "mappings": normalized
    }

def normalize_order_mapping(base_columns, compare_columns, order_mapping):
    if not order_mapping:
        return {
            "success": False,
            "error": "Select an order column before comparing."
        }

    base_by_name = {column["name"]: column for column in base_columns}
    compare_by_name = {column["name"]: column for column in compare_columns}
    base_name = order_mapping.get("baseColumn")
    compare_name = order_mapping.get("compareColumn")

    if base_name not in base_by_name:
        return {
            "success": False,
            "error": f"Order base column not found: {base_name}"
        }

    if compare_name not in compare_by_name:
        return {
            "success": False,
            "error": f"Order compare column not found: {compare_name}"
        }

    base_column = base_by_name[base_name]
    compare_column = compare_by_name[compare_name]

    if base_column["typeSignature"] != compare_column["typeSignature"]:
        return {
            "success": False,
            "error": f"Order column type mismatch for {base_name} -> {compare_name}. Both order columns must have the same type.",
            "baseColumn": base_column,
            "compareColumn": compare_column
        }

    return {
        "success": True,
        "orderMapping": {
            "baseColumn": base_name,
            "compareColumn": compare_name
        }
    }

def compare_parquet_files(base_path, compare_path, mappings=None, order_mapping=None):
    print(f"DEBUG: Starting parquet compare: {base_path} vs {compare_path}", file=sys.stderr)

    if not os.path.exists(base_path):
        return {
            "success": False,
            "error": f"Base file does not exist: {base_path}"
        }

    if not os.path.exists(compare_path):
        return {
            "success": False,
            "error": f"Compare file does not exist: {compare_path}"
        }

    base_conn = None
    compare_conn = None

    try:
        base_conn = duckdb.connect()
        compare_conn = duckdb.connect()
        base_columns = read_compare_columns(base_conn, base_path)
        compare_columns = read_compare_columns(compare_conn, compare_path)
        mapping_result = normalize_compare_mappings(base_columns, compare_columns, mappings)
        order_result = normalize_order_mapping(base_columns, compare_columns, order_mapping)

        if not mapping_result["success"]:
            base_conn.close()
            compare_conn.close()
            base_conn = None
            compare_conn = None
            return dict({
                "basePath": base_path,
                "comparePath": compare_path,
            }, **mapping_result)

        if not order_result["success"]:
            base_conn.close()
            compare_conn.close()
            base_conn = None
            compare_conn = None
            return dict({
                "basePath": base_path,
                "comparePath": compare_path,
            }, **order_result)

        normalized_mappings = mapping_result["mappings"]
        normalized_order_mapping = order_result["orderMapping"]
        display_columns = [mapping["displayColumn"] for mapping in normalized_mappings]
        base_select_columns = ", ".join(
            duckdb_identifier(mapping["baseColumn"])
            for mapping in normalized_mappings
        )
        compare_select_columns = ", ".join(
            duckdb_identifier(mapping["compareColumn"])
            for mapping in normalized_mappings
        )

        total_rows_base = base_conn.execute(f"SELECT COUNT(*) FROM {TABLE_NAME}").fetchone()[0]
        total_rows_compare = compare_conn.execute(f"SELECT COUNT(*) FROM {TABLE_NAME}").fetchone()[0]

        base_order_column = duckdb_identifier(normalized_order_mapping["baseColumn"])
        compare_order_column = duckdb_identifier(normalized_order_mapping["compareColumn"])
        base_cursor = base_conn.execute(
            f"SELECT {base_select_columns} FROM {TABLE_NAME} ORDER BY {base_order_column}"
        )
        compare_cursor = compare_conn.execute(
            f"SELECT {compare_select_columns} FROM {TABLE_NAME} ORDER BY {compare_order_column}"
        )

        mismatches = []
        mismatch_count = 0
        row_index = 0

        while True:
            base_rows = base_cursor.fetchmany(1000)
            compare_rows = compare_cursor.fetchmany(1000)

            if not base_rows and not compare_rows:
                break

            batch_size = max(len(base_rows), len(compare_rows))

            for batch_index in range(batch_size):
                base_row = base_rows[batch_index] if batch_index < len(base_rows) else None
                compare_row = compare_rows[batch_index] if batch_index < len(compare_rows) else None
                mismatch_type = None
                mismatched_columns = []

                if base_row is None:
                    mismatch_type = "missing_in_base"
                    mismatched_columns = display_columns
                elif compare_row is None:
                    mismatch_type = "missing_in_compare"
                    mismatched_columns = display_columns
                else:
                    for column, base_value, compare_value in zip(display_columns, base_row, compare_row):
                        if base_value != compare_value:
                            mismatched_columns.append(column)

                    if mismatched_columns:
                        mismatch_type = "value_mismatch"

                if mismatch_type:
                    mismatch_count += 1
                    if len(mismatches) < MAX_COMPARE_MISMATCHES:
                        mismatches.append({
                            "rowIndex": row_index,
                            "type": mismatch_type,
                            "base": row_to_dict(display_columns, base_row),
                            "compare": row_to_dict(display_columns, compare_row),
                            "mismatchedColumns": mismatched_columns
                        })

                row_index += 1

        base_conn.close()
        compare_conn.close()
        base_conn = None
        compare_conn = None

        return {
            "success": True,
            "basePath": base_path,
            "comparePath": compare_path,
            "columns": display_columns,
            "totalRowsBase": total_rows_base,
            "totalRowsCompare": total_rows_compare,
            "rowsCompared": row_index,
            "mismatchCount": mismatch_count,
            "mismatches": mismatches,
            "mappings": normalized_mappings,
            "orderMapping": normalized_order_mapping,
            "mismatchLimit": MAX_COMPARE_MISMATCHES,
            "truncated": mismatch_count > len(mismatches)
        }

    except Exception as e:
        if base_conn is not None:
            base_conn.close()
        if compare_conn is not None:
            compare_conn.close()

        import traceback
        print(f"DEBUG: Error comparing parquet files: {str(e)}", file=sys.stderr)
        print(f"DEBUG: Traceback: {traceback.format_exc()}", file=sys.stderr)

        return {
            "success": False,
            "basePath": base_path,
            "comparePath": compare_path,
            "error": str(e),
            "traceback": traceback.format_exc()
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({
            'success': False,
            'error': 'Usage: python read_parquet.py <file_path> [query] [--export csv|json|sqlite <output_path>] [--compare compare_path [mappings_json] [order_mapping_json]] [--compare-metadata compare_path] [--schema-drift reference_path] [--dataset-scan folder_path]'
        }))
        sys.exit(1)
    
    file_path = sys.argv[1]
    args = sys.argv[2:]

    if "--compare-metadata" in args:
        metadata_index = args.index("--compare-metadata")

        if len(args) < metadata_index + 2:
            result = {
                'success': False,
                'error': 'Usage: python read_parquet.py <file_path> --compare-metadata <compare_path>'
            }
        else:
            compare_path = args[metadata_index + 1]
            result = get_compare_metadata(file_path, compare_path)
    elif "--schema-drift" in args:
        drift_index = args.index("--schema-drift")

        if len(args) < drift_index + 2:
            result = {
                'success': False,
                'error': 'Usage: python read_parquet.py <file_path> --schema-drift <reference_path>'
            }
        else:
            reference_path = args[drift_index + 1]
            result = detect_schema_drift(file_path, reference_path)
    elif "--dataset-scan" in args:
        dataset_index = args.index("--dataset-scan")

        if len(args) < dataset_index + 2:
            result = {
                'success': False,
                'error': 'Usage: python read_parquet.py <file_path> --dataset-scan <folder_path>'
            }
        else:
            folder_path = args[dataset_index + 1]
            result = analyze_dataset_partitions(folder_path)
    elif "--compare" in args:
        compare_index = args.index("--compare")

        if len(args) < compare_index + 2:
            result = {
                'success': False,
                'error': 'Usage: python read_parquet.py <file_path> --compare <compare_path> [mappings_json] [order_mapping_json]'
            }
        else:
            compare_path = args[compare_index + 1]
            mappings = None
            order_mapping = None
            if len(args) > compare_index + 2 and args[compare_index + 2].strip():
                mappings = json.loads(args[compare_index + 2])
            if len(args) > compare_index + 3 and args[compare_index + 3].strip():
                order_mapping = json.loads(args[compare_index + 3])
            result = compare_parquet_files(file_path, compare_path, mappings, order_mapping)
    elif "--export" in args:
        export_index = args.index("--export")
        user_query = args[0] if export_index > 0 and args[0].strip() else None

        if len(args) < export_index + 3:
            result = {
                'success': False,
                'error': 'Usage: python read_parquet.py <file_path> [query] --export csv|json|sqlite <output_path>'
            }
        else:
            export_format = args[export_index + 1]
            output_path = args[export_index + 2]
            result = export_parquet_file(file_path, output_path, export_format, user_query)
    else:
        user_query = args[0] if len(args) == 1 else None
        result = read_parquet_file(file_path, user_query)

    print(json.dumps(result))
