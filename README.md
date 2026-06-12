# tree-sitter-allium

Tree-sitter grammar for the [Allium](https://github.com/juxt/allium-tools) specification language.

## Usage

### Neovim

The [nvim-allium](https://github.com/juxt/nvim-allium) plugin handles tree-sitter setup automatically.

### Emacs

The [allium-mode](https://github.com/juxt/allium-mode) plugin includes tree-sitter support for Emacs 29+. See its README for grammar installation.

### Other editors

Editors with tree-sitter support (Helix, Zed) can use this grammar directly. Build instructions below.

## Building

Install dependencies:

```bash
npm install
```

Generate the parser from `grammar.js` and build all artifacts:

```bash
npm run build
```

This runs `tree-sitter generate`, then builds the native `.node` binding and the `.wasm` binding. The WASM step requires `emscripten` and is skipped if unavailable.

## Testing

```bash
tree-sitter test
```

Corpus tests live in `test/corpus/`.

## Compatibility

Allium Tools core 3.x. The grammar tracks the reference parser in [juxt/allium-tools](https://github.com/juxt/allium-tools); current as of core 3.3.

## Licence

[MIT](LICENSE)
