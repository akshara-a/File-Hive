# VS Code Extension Release Guide

Run commands from the repository root:

# Required Checks

Use this quick verification pass before packaging or handing off changes:

```powershell
npm.cmd run compile
npm.cmd run copy-files
npm.cmd run lint
py -3 -c "import ast, pathlib; ast.parse(pathlib.Path('src/read_data_file.py').read_text())"
```

These checks cover the TypeScript build, Python helper copy step, lint rules, and a fast syntax check for the data file reader bridge.

## Packaging

Use `@vscode/vsce` to create the installable VSIX package:

```powershell
npx.cmd @vscode/vsce package
```

The package is written to the repository root as a `.vsix` file, for example `parquet-x-1.2.0.vsix`.

The Marketplace package identity intentionally remains `parquet-x` even though the displayed product name is File Hive. Keep `package.json.name` as `parquet-x` so Marketplace publishes update the existing `CosmicTechnoid.parquet-x` listing.

To install and smoke-test the package locally:

```powershell
code.cmd --install-extension .\parquet-x-1.2.0.vsix
```

If the version in `package.json` changes, update the `.vsix` filename in the install command.

## Publishing

Before the first publish, make sure the `publisher` value in `package.json` matches your Visual Studio Marketplace publisher ID. This project currently uses `CosmicTechnoid`.

Sign in once with a Marketplace Personal Access Token:

```powershell
npx.cmd @vscode/vsce login CosmicTechnoid
```

Publish the current package version to the Marketplace:

```powershell
npx.cmd @vscode/vsce publish
```

For CI or one-off publishing without an interactive login, set `VSCE_PAT` and run the same publish command:

```powershell
$env:VSCE_PAT = "<marketplace-personal-access-token>"
npx.cmd @vscode/vsce publish
```

## Notes

- `npm.cmd run compile` writes the extension output to `out/`.
- `npm.cmd run copy-files` keeps Python helper files available beside the compiled extension code.
- Re-run the Python syntax check whenever `src/read_data_file.py` changes.
- Review `.vscodeignore` before packaging so development-only files are not included in the VSIX.
