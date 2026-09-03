<h1 align="left">
    <img src="https://github.com/pucelle/lupos-vscode/blob/master/images/logo.png?raw=true" width="32" height="32" alt="Lupos Logo" />
    VSCode Lupos
</h1>

This vscode plugin provides Syntax Highlighting and IntelliSense for Tagged Template in [lupos.html](https://github.com/pucelle/lupos.html).



## Features

For Lupos Template Literal, this plugin provides:

- HTML & CSS Highlighting and IntelliSense
- Auto Completion
- Quick Info
- Goto Definition and References
- Diagnostics
- Quick Fix for import missing
- Renaming for Component, Property, Binding.



## Development and Debugging

Before running, call `npm run link` (only work in Windows) to link server part to `node_modules`.

If wanting to debug server part, please follow comments in `packages/lupos-server/src/core/logger.ts`.



## Not provided, but plan to

- `>${...}<` slot content completion. Now can only complete for object properties.
- Validate circular references. I believe this should be superior difficult.
- Decorates a variable or property to describe whether it gets observed.



## References

This plugin was inspired by <https://github.com/mjbvz/vscode-lit-html> and <https://github.com/runem/lit-analyzer>.
