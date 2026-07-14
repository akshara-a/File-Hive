# Developer Instructions

```powershell
npm.cmd run compile
npm.cmd run copy-files
npm.cmd run lint
py -3 -c "import ast, pathlib; ast.parse(pathlib.Path('src/read_parquet.py').read_text())"
```
