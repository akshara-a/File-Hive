export const EXTENSION_NAME = 'Parquet Viewer';
export const MESSAGES = {
    ENVIRONMENT_INITIALIZING: "Setting up environment for Parquet Viewer...",
    ENVIRONMENT_SETUP_FAILED: "Parquet Viewer: Failed to setup environment for Parquet Viewer.",
    ENVIRONMENT_RESETTING: "Resetting environment for Parquet Viewer...",
    ENVIRONMENT_RESET_SUCCESS: "Parquet Viewer: Environment reset successfully.",
    ENVIRONMENT_RESET_FAILED: "Parquet Viewer: Failed to reset environment for Parquet Viewer.",
    ENVIRONMENT_RESET_WARNING: "Reset Parquet Viewer environment and reinstall dependencies?",
    SYSTEM_PYTHON_PATH_NOT_AVAILABLE: "Python not available. Please select a Python interpreter in VS Code.",
    STATE_MISMATCH_DETECTED: "State mismatch detected: venv missing but marked as initialized",
};
export const REGISTER_COMMANDS = {
    REFRESH: "parquetViewer.refresh",
    SHOW_LOGS: "parquetViewer.showLogs",
    RESET_ENVIRONMENT: "parquetViewer.resetEnvironment"
}
export const SHOW_LOGS = "Show Logs";
export const RESET_ENVIRONMENT = "Reset Environment";
export const CANCEL = "Cancel";
export const VS_CODE_PYTHON_EXTENSION = "ms-python.python";
export const WINDOWS_PLATFORM = "win32";
export const NONCE_STRING_POSSIBLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export const VIEW_TYPE = "parquetViewer.parquetViewer";
export const MESSAGE_TYPE_REFRESH = "refresh";
export const VENV_FOLDER = ".parquet-venv";
export const SCRIPTS_FOLDER = "Scripts";
export const PYTHON_EXE = "python.exe";
export const BIN_FOLDER = "bin";
export const PYTHON = "python";
export const PARQUET_VIEWER_INITIALIZED_STATE = "parquetViewerInitialized";