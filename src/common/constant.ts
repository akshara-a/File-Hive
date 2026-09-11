export const EXTENSION_NAME = 'File Hive';
export const MESSAGES = {
    ENVIRONMENT_INITIALIZING: "Setting up environment for File Hive...",
    ENVIRONMENT_SETUP_SUCCESS: "File Hive: Python environment is ready.",
    ENVIRONMENT_SETUP_FAILED: "File Hive: Failed to setup environment for File Hive.",
    ENVIRONMENT_RESETTING: "Resetting environment for File Hive...",
    ENVIRONMENT_RESET_SUCCESS: "File Hive: Environment reset successfully.",
    ENVIRONMENT_RESET_FAILED: "File Hive: Failed to reset environment for File Hive.",
    ENVIRONMENT_RESET_WARNING: "Reset File Hive environment and reinstall dependencies?",
    ENVIRONMENT_DOCTOR_READY: "File Hive: Environment diagnostics written to the Output panel.",
    SYSTEM_PYTHON_PATH_NOT_AVAILABLE: "Python not available. Please select a Python interpreter in VS Code."
};
export const REGISTER_COMMANDS = {
    REFRESH: "fileHive.refresh",
    SETUP_ENVIRONMENT: "fileHive.setupEnvironment",
    SHOW_LOGS: "fileHive.showLogs",
    RESET_ENVIRONMENT: "fileHive.resetEnvironment",
    ENVIRONMENT_DOCTOR: "fileHive.environmentDoctor",
    MOUNT_WORKSPACE: "fileHive.mountWorkspace",
    OPEN_JSON_VIEWER: "fileHive.openJsonViewer"
};
export const SHOW_LOGS = "Show Logs";
export const RESET_ENVIRONMENT = "Reset Environment";
export const RETRY_SETUP = "Retry Setup";
export const ENVIRONMENT_DOCTOR = "Environment Doctor";
export const CANCEL = "Cancel";
export const VS_CODE_PYTHON_EXTENSION = "ms-python.python";
export const WINDOWS_PLATFORM = "win32";
export const NONCE_STRING_POSSIBLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
