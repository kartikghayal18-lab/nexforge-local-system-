# Setup (macOS)

## Prerequisites
1. **Node.js 18+** and **npm** — install via https://nodejs.org or `brew
   install node`. Verify: `node -v && npm -v`.
2. **Rust + Cargo** — install via https://rustup.rs:
   ```
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
   Then restart your terminal (or `source "$HOME/.cargo/env"`) and verify:
   ```
   rustc --version
   cargo --version
   ```
   As of this writing, Rust is **not installed** in this project's
   development environment — every Rust file has been written and
   reviewed for correctness but never compiled. Installing Rust and
   running the commands below is a required next step before the desktop
   app can be considered verified.
3. **Xcode Command Line Tools** (macOS build toolchain Rust/Tauri need):
   ```
   xcode-select --install
   ```
4. **Tauri CLI** — already a devDependency (`@tauri-apps/cli`), installed
   by `npm install`; no separate global install needed.

## Install
```
npm install
```

## Development
- **Browser preview** (fast UI iteration, no persistence, demo data only):
  ```
  npm run dev
  ```
- **Desktop app** (real SQLite, real vault, real file storage — the actual
  product):
  ```
  npm run tauri:dev
  ```
  First run will take a while — Cargo compiles every Rust dependency
  (SQLite, cryptography, PDF generation, Tauri itself) from source.

## Production build
```
npm run build        # frontend only, outputs to dist/
npm run tauri:build  # full desktop app: .app bundle and .dmg installer
```
Build artifacts land under `src-tauri/target/release/bundle/macos/` (the
`.app`) and `src-tauri/target/release/bundle/dmg/` (the `.dmg`).

## Verifying the Rust side independently
```
cd src-tauri
cargo check   # fast type-check, no full build
cargo build   # full debug build
```
Run these before `npm run tauri:dev` the first time — `cargo check` gives
much faster feedback on any compile errors (e.g. crate API mismatches in
`pdf.rs`'s `printpdf`/`image` usage, which has not been compiler-verified).

## Troubleshooting
- **`cargo: command not found`** — Rust isn't installed or your shell
  hasn't picked up `~/.cargo/bin` on `PATH` yet; open a new terminal tab
  or run `source "$HOME/.cargo/env"`.
- **`xcrun: error` / linker errors on macOS** — run `xcode-select
  --install` and retry.
- **`error: linking with 'cc' failed`** — usually also fixed by the Xcode
  Command Line Tools above.
- **Stray `vite.config.js` / `vite.config.d.ts` reappearing at the repo
  root** — this was a real bug from `tsconfig.node.json` not scoping
  `tsc -b`'s output; it's fixed (an `outDir` was added), but if you ever
  see these files again after editing `tsconfig.node.json`, delete them
  and re-run `npm run build`.
- **`npm run build` fails with a `printpdf`/`image` crate error** — that's
  a Rust build failure, not a frontend one; run `cargo check` in
  `src-tauri` to see the real error and report it so it can be fixed.
- **First `npm run tauri:dev` is very slow** — normal; Cargo is compiling
  the full dependency tree from source the first time. Subsequent runs
  are much faster (incremental compilation).
