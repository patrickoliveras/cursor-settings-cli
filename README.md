# cursor-settings-cli

### Use at your own risk!

CLI tools to extract, compare, and replace JSON values stored in Cursor's `state.vscdb` SQLite database.

Inspired by the discovery and write-up on Cursor settings storage by Jack Youstra: [Cursor settings location](https://www.jackyoustra.com/blog/cursor-settings-location).


## Install

```bash
npm i -g cursor-settings-cli
```

Or from a local clone:

```bash
npm i -g .
```

## Usage

```bash
cursor-settings extract --help
cursor-settings compare --help
cursor-settings replace --help
```

You can override the DB path with `--db` or the env var `CURSOR_STATE_DB`.

## Development

- Requirements: Node 16+, `sqlite3` on PATH
- Install deps: `npm install`
- Typecheck: `npm run typecheck`
- Build: `npm run build` (outputs to `dist/`)
- Lint: `npm run lint` (auto-fix: `npm run lint:fix`)
- Format: `npm run format` (check only: `npm run format:check`)
- Test (placeholder): `npm test`
- Run local built CLIs:
  - `node dist/bin/cursor-settings.js --help`

## Contributing

- Commits follow Conventional Commits. Example: `feat(compare): add --unordered for array diff`
- Pre-commit runs Prettier + ESLint on staged files
- CI runs typecheck, lint, format check, build, and tests on PRs

## Safety

- The replace command creates a JSON backup and optionally a full DB copy before writing.
- Close Cursor before writing to avoid locks. The tool will warn if the DB seems unwritable.

## License

MIT
