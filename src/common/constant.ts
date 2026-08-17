export const EXTENSION_NAME = 'Parquet Viewer';
export const MESSAGES = {
    ENVIRONMENT_INITIALIZING: "Setting up environment for Parquet Viewer...",
    ENVIRONMENT_SETUP_SUCCESS: "Parquet Viewer: Python environment is ready.",
    ENVIRONMENT_SETUP_FAILED: "Parquet Viewer: Failed to setup environment for Parquet Viewer.",
    ENVIRONMENT_RESETTING: "Resetting environment for Parquet Viewer...",
    ENVIRONMENT_RESET_SUCCESS: "Parquet Viewer: Environment reset successfully.",
    ENVIRONMENT_RESET_FAILED: "Parquet Viewer: Failed to reset environment for Parquet Viewer.",
    ENVIRONMENT_RESET_WARNING: "Reset Parquet Viewer environment and reinstall dependencies?",
    ENVIRONMENT_DOCTOR_READY: "Parquet Viewer: Environment diagnostics written to the Output panel.",
    SYSTEM_PYTHON_PATH_NOT_AVAILABLE: "Python not available. Please select a Python interpreter in VS Code."
};
export const REGISTER_COMMANDS = {
    REFRESH: "parquetViewer.refresh",
    SETUP_ENVIRONMENT: "parquetViewer.setupEnvironment",
    SHOW_LOGS: "parquetViewer.showLogs",
    RESET_ENVIRONMENT: "parquetViewer.resetEnvironment",
    ENVIRONMENT_DOCTOR: "parquetViewer.environmentDoctor"
};
export const SHOW_LOGS = "Show Logs";
export const RESET_ENVIRONMENT = "Reset Environment";
export const RETRY_SETUP = "Retry Setup";
export const ENVIRONMENT_DOCTOR = "Environment Doctor";
export const CANCEL = "Cancel";
export const VS_CODE_PYTHON_EXTENSION = "ms-python.python";
export const WINDOWS_PLATFORM = "win32";
export const NONCE_STRING_POSSIBLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
