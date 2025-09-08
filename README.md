# VSCode Lupos

This plugin provides syntax highlighting and IntelliSense for Tagged Template of [lupos.js](https://github.com/pucelle/lupos.js).


## Features

#### Template Literal Language Service

For Template Literal, this plugin provides HTML & CSS language service.

Otherwise, for Components & Bindings & Events, it provides:

- Auto Completion.
- Quick Info.
- Goto Definition.
- Diagnostics.
- Import Missing Quick Fix.


#### Install and Debugging

Before running, call `npm run link` to link server part to `node_modules`.

If wanting to debug server part, please follow comments in `packages/lupos-server/src/core/logger.ts`.


#### Not provided, but plan to

- `>${...}<` slot content completion. Now can only complete for object properties.
- Validate circular references, I believe this should be superior hard.
- Warn about parameters lost tracking, like `items.map(({name}) => {...})`, or when call argument is observed, but method parameter is not.
- Validate tag not rightly match or closed. e.g., `</div`.
- Can find reference and rename `<Com>` or `:binding`, properties and event names.

- Warn about filtered list lost tracking, like `filtered = items.filter(...)`, `items` get observed, but `filtered` is not by default.
- `.prop` without value specified can only assign to `boolean`.
- Can import modules after complete component or binding name.
- Provides completion and quick info for control command, and their properties, like `<lu:keyed weakCache>`.
- Can diagnose required, but not provided properties.


## More About

This plugin was inspired by <https://github.com/mjbvz/vscode-lit-html> and <https://github.com/runem/lit-analyzer>.
