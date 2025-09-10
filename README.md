# VSCode Lupos

This plugin provides syntax highlighting and IntelliSense for Tagged Template in [lupos.js](https://github.com/pucelle/lupos.js).



## Features

For Lupos Template Literal, this plugin provides:

- HTML & CSS Highlighting and IntelliSense
- Auto Completion
- Quick Info
- Goto Definition
- Diagnostics
- Quick Fix for import missing



## Development and Debugging

Before running, call `npm run link` to link server part to `node_modules`.

If wanting to debug server part, please follow comments in `packages/lupos-server/src/core/logger.ts`.



## Not provided, but plan to

- `>${...}<` slot content completion. Now can only complete for object properties.
- Validate circular references, I believe this should be superior hard.
- Validate tag not rightly match or closed. e.g., `</div`.
- Can find reference and rename `<Com>` or `:binding`, properties and event names.
- Decorates a variable or property to describe whether it is observed.



## More About

This plugin was inspired by <https://github.com/mjbvz/vscode-lit-html> and <https://github.com/runem/lit-analyzer>.
