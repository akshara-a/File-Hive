import duckdb
import csv
import json
import sqlite3
import sys
import os

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

def compare_parquet_files(base_path, compare_path):
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
        create_named_parquet_view(base_conn, TABLE_NAME, base_path)
        create_named_parquet_view(compare_conn, TABLE_NAME, compare_path)

        base_cursor = base_conn.execute(f"SELECT * FROM {TABLE_NAME} LIMIT 0")
        base_columns = [desc[0] for desc in base_cursor.description]
        compare_cursor = compare_conn.execute(f"SELECT * FROM {TABLE_NAME} LIMIT 0")
        compare_columns = [desc[0] for desc in compare_cursor.description]

        if base_columns != compare_columns:
            base_conn.close()
            compare_conn.close()
            base_conn = None
            compare_conn = None
            return {
                "success": False,
                "basePath": base_path,
                "comparePath": compare_path,
                "error": "Only Parquet files with the same columns in the same order can be compared.",
                "baseColumns": base_columns,
                "compareColumns": compare_columns
            }

        display_columns = make_unique_column_names(base_columns)
        total_rows_base = base_conn.execute(f"SELECT COUNT(*) FROM {TABLE_NAME}").fetchone()[0]
        total_rows_compare = compare_conn.execute(f"SELECT COUNT(*) FROM {TABLE_NAME}").fetchone()[0]

        base_cursor = base_conn.execute(f"SELECT * FROM {TABLE_NAME}")
        compare_cursor = compare_conn.execute(f"SELECT * FROM {TABLE_NAME}")

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
            'error': 'Usage: python read_parquet.py <file_path> [query] [--export csv|json|sqlite <output_path>] [--compare compare_path]'
        }))
        sys.exit(1)
    
    file_path = sys.argv[1]
    args = sys.argv[2:]

    if "--compare" in args:
        compare_index = args.index("--compare")

        if len(args) < compare_index + 2:
            result = {
                'success': False,
                'error': 'Usage: python read_parquet.py <file_path> --compare <compare_path>'
            }
        else:
            compare_path = args[compare_index + 1]
            result = compare_parquet_files(file_path, compare_path)
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
