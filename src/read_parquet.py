import duckdb
import json
import sys
import os

def read_parquet_file(file_path):
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
    
    try:
        # Get file info
        file_size = os.path.getsize(file_path)
        print(f"DEBUG: File size: {file_size} bytes", file=sys.stderr)
        
        # Connect to DuckDB
        conn = duckdb.connect()
        print("DEBUG: DuckDB connected successfully", file=sys.stderr)
        
        # Read data with limit
        query = f"SELECT * FROM read_parquet('{file_path}') LIMIT 1000"
        print(f"DEBUG: Executing query: {query}", file=sys.stderr)
        
        result = conn.execute(query).fetchall()
        columns = [desc[0] for desc in conn.description]
        
        print(f"DEBUG: Retrieved {len(result)} rows, {len(columns)} columns", file=sys.stderr)
        print(f"DEBUG: Columns: {columns}", file=sys.stderr)
        
        # Convert to JSON-serializable format
        data = []
        for i, row in enumerate(result):
            row_dict = {}
            for col_name, value in zip(columns, row):
                if value is None:
                    row_dict[col_name] = None
                elif isinstance(value, (int, float, bool, str)):
                    row_dict[col_name] = value
                else:
                    row_dict[col_name] = str(value)
            data.append(row_dict)
        
        conn.close()
        
        return {
            'success': True,
            'data': data,
            'columns': columns,
            'rowCount': len(data),
            'totalRows': len(result),
            'debug': {
                'file_path': file_path,
                'file_size': file_size,
                'columns_count': len(columns),
                'rows_returned': len(data)
            }
        }
        
    except Exception as e:
        import traceback
        print(f"DEBUG: Error reading parquet file: {str(e)}", file=sys.stderr)
        print(f"DEBUG: Traceback: {traceback.format_exc()}", file=sys.stderr)
        
        return {
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc(),
            'debug': {
                'file_path': file_path,
                'file_exists': True,
                'file_size': file_size
            }
        }

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({
            'success': False,
            'error': 'Usage: python read_parquet.py <file_path>'
        }))
        sys.exit(1)
    
    file_path = sys.argv[1]
    result = read_parquet_file(file_path)
    print(json.dumps(result))