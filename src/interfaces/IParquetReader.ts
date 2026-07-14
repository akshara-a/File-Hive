import * as vscode from 'vscode';

export interface IParquetReader {
    readParquetFile(uri: vscode.Uri, query?: string): Promise<ParquetDataResult>;
}

export interface ParquetDataResult {
    success: boolean;
    data?: any[];
    columns?: string[];
    rowCount?: number;
    totalRows?: number;
    query?: string;
    resultLimited?: boolean;
    schema?: ParquetSchemaResult;
    error?: string;
    traceback?: string;
}

export interface ParquetSchemaResult {
    columns: ParquetSchemaColumn[];
    tree: ParquetSchemaColumn[];
    raw: any[];
    columnCount: number;
}

export interface ParquetSchemaColumn {
    name: string;
    path: string;
    parentPath?: string;
    depth: number;
    physicalType?: string;
    logicalType?: string;
    convertedType?: string;
    nullableStatus: string;
    repetitionType?: string;
    repetitionLevel: number;
    definitionLevel: number;
    decimalPrecision?: number;
    decimalScale?: number;
    timestampUnit?: string;
    timestampTimezoneInterpretation?: string;
    timestampIsAdjustedToUTC?: boolean;
    numChildren: number;
    children: ParquetSchemaColumn[];
}
