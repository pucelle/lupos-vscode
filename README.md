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

- `>${...}<` slot content completion. Haven't find a way to do this.
- Ensure `onCreated`, `onReady`, `onUpdated`, `onConnected`, `onWillDisconnect` call `super.onXXX()`.
- Prevent writing operations inside `render`, `@watch`, `@computed`.
- If bound global listeners, ensure unbind it in `onWillDisconnect`.
- Validate circular references, I believe this should be hard.
- Warn about parameters lost tracking, like `items.map(({name}) => {...})`, or when call parameter is observed, but method parameter is not.
- Validate tag not rightly match or closed. e.g., `</div`.
- Can import modules in component or binding completion.


## More About

This plugin was inspired by <https://github.com/mjbvz/vscode-lit-html> and <https://github.com/runem/lit-analyzer>.
