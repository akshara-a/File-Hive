import * as vscode from 'vscode';

export interface IParquetReader {
    readParquetFile(uri: vscode.Uri, query?: string): Promise<ParquetDataResult>;
    exportParquetFile(
        uri: vscode.Uri,
        format: ParquetExportFormat,
        outputUri: vscode.Uri,
        query?: string
    ): Promise<ParquetExportResult>;
    getParquetCompareMetadata(uri: vscode.Uri, compareUri: vscode.Uri): Promise<ParquetCompareMetadataResult>;
    compareParquetFile(
        uri: vscode.Uri,
        compareUri: vscode.Uri,
        mappings?: ParquetCompareMapping[],
        orderMapping?: ParquetCompareOrderMapping
    ): Promise<ParquetCompareResult>;
}

export type ParquetExportFormat = 'csv' | 'json' | 'sqlite';

export interface ParquetDataResult {
    success: boolean;
    data?: any[];
    columns?: string[];
    rowCount?: number;
    totalRows?: number;
    query?: string;
    resultLimited?: boolean;
    schema?: ParquetSchemaResult;
    doctor?: ParquetDoctorResult;
    error?: string;
    traceback?: string;
}

export interface ParquetDoctorResult {
    healthReport: ParquetDoctorHealthReport;
    integrity: Record<string, any>;
    schemaValidation: {
        columns: ParquetDoctorSchemaColumn[];
    };
    rowGroupAnalysis: {
        rowGroups: ParquetDoctorRowGroup[];
    };
    columnStatistics: {
        columns: ParquetDoctorColumnStatistics[];
    };
}

export interface ParquetDoctorHealthReport {
    healthScore: number;
    errors: ParquetDoctorIssue[];
    warnings: ParquetDoctorIssue[];
    passedChecks: ParquetDoctorIssue[];
    recommendations: string[];
}

export interface ParquetDoctorIssue {
    category: string;
    message: string;
    recommendation?: string;
}

export interface ParquetDoctorSchemaColumn {
    name?: string;
    path?: string;
    physicalType?: string;
    logicalType?: string;
    nullableStatus?: string;
    decimalPrecision?: number;
    decimalScale?: number;
    timestampUnit?: string;
    status: string;
    issues: string[];
}

export interface ParquetDoctorRowGroup {
    id: number | string;
    rowCount: number;
    compressedSize?: number;
    uncompressedSize?: number;
    compressionRatio?: number;
    columnChunks: any[];
    issues: string[];
}

export interface ParquetDoctorColumnStatistics {
    column: string;
    hasMinMax: boolean;
    hasNullCount: boolean;
    hasDistinctCount: boolean;
    nullCount?: number;
    distinctCount?: number;
    allNull: boolean;
    constantValue: boolean;
    issues: string[];
}

export interface ParquetExportResult {
    success: boolean;
    format?: ParquetExportFormat;
    outputPath?: string;
    rowsExported?: number;
    query?: string;
    error?: string;
    traceback?: string;
}

export interface ParquetCompareResult {
    success: boolean;
    basePath?: string;
    comparePath?: string;
    columns?: string[];
    totalRowsBase?: number;
    totalRowsCompare?: number;
    rowsCompared?: number;
    mismatchCount?: number;
    mismatches?: ParquetRowMismatch[];
    mappings?: ParquetCompareMapping[];
    orderMapping?: ParquetCompareOrderMapping;
    mismatchLimit?: number;
    truncated?: boolean;
    error?: string;
    traceback?: string;
}

export interface ParquetCompareMetadataResult {
    success: boolean;
    basePath?: string;
    comparePath?: string;
    baseColumns?: ParquetCompareColumn[];
    compareColumns?: ParquetCompareColumn[];
    error?: string;
    traceback?: string;
}

export interface ParquetCompareColumn {
    name: string;
    path: string;
    duckdbType?: string;
    physicalType?: string;
    logicalType?: string;
    nullableStatus?: string;
    decimalPrecision?: number;
    decimalScale?: number;
    timestampUnit?: string;
    typeSignature: string;
}

export interface ParquetCompareMapping {
    baseColumn: string;
    compareColumn: string;
    displayColumn?: string;
}

export interface ParquetCompareOrderMapping {
    baseColumn: string;
    compareColumn: string;
}

export interface ParquetRowMismatch {
    rowIndex: number;
    type: 'value_mismatch' | 'missing_in_base' | 'missing_in_compare';
    base?: Record<string, any>;
    compare?: Record<string, any>;
    mismatchedColumns: string[];
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
