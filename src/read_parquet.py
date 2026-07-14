import duckdb
import json
import sys
import os

MAX_RESULT_ROWS = 1000
TABLE_NAME = "parquet_data"

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

if __name__ == "__main__":
    if len(sys.argv) not in (2, 3):
        print(json.dumps({
            'success': False,
            'error': 'Usage: python read_parquet.py <file_path> [query]'
        }))
        sys.exit(1)
    
    file_path = sys.argv[1]
    user_query = sys.argv[2] if len(sys.argv) == 3 else None
    result = read_parquet_file(file_path, user_query)
    print(json.dumps(result))
