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

```bash
npm install
tree-sitter generate
```

### Native binding

```bash
npm run build:native
```

### WASM binding

Requires `emscripten`:

```bash
npm run build:wasm
```

## Testing

```bash
tree-sitter test
```

Corpus tests live in `test/corpus/`.

## Licence

[MIT](LICENSE)
