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

- `>${...}<` slot content type checking, completion. Haven't find a way to do this.
- `<lu:if ...>` can narrow variable types for it's content.
- Type checking and relation between `data` and `renderer` of `<lu:for ${data}>${renderer}`.
- Defined Transition names completion.
- HTML Element `.property` Completion & Quick Info & Diagnostic.
- Ensure `onCreated`, `onReady`, `onUpdated`, `onConnected`, `onWillDisconnect` call `super.onXXX()`.
- Prevent writing operations inside `render`, `@watch`, `@computed`.
- If bound global listeners, ensure unbind it in `onWillDisconnect`.
- Validate circular references, I believe this should be hard.
- Warn about parameters lost tracking, like `items.map(({name}) => {...})`, or when call parameter is observed, but method parameter is not.
- Validate event handler, especially when forget to use function to contain parameters.
- Validate tag not rightly match or closed. e.g., `</div`.

## More About

This plugin was inspired by <https://github.com/mjbvz/vscode-lit-html> and <https://github.com/runem/lit-analyzer>.
