import * as assert from 'assert';
import * as vscode from 'vscode';

suite('File Hive extension commands', () => {
    test('registers environment support commands', async () => {
        const extension = vscode.extensions.getExtension('CosmicTechnoid.parquet-x')
            || vscode.extensions.getExtension('cosmictechnoid.parquet-x')
            || vscode.extensions.all.find((candidate) => candidate.packageJSON?.name === 'parquet-x');
        assert.ok(extension, 'File Hive extension should be available in the test host');

        await extension.activate();

        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes('fileHive.setupEnvironment'), 'setup command should be registered');
        assert.ok(commands.includes('fileHive.showLogs'), 'show logs command should be registered');
        assert.ok(commands.includes('fileHive.resetEnvironment'), 'reset command should be registered');
        assert.ok(commands.includes('fileHive.environmentDoctor'), 'environment doctor command should be registered');
    });
});
