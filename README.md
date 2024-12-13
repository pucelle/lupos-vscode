# VSCode Lupos

This plugin can **only** work with [lupos.js](https://github.com/pucelle/lupos.js).


## Features

#### Template Liternal

For Template Liternal, this plugin provides:

- Template Syntax Highlighting and IntelliSense for HTML & CSS tags and Attributes.
- `>${...}<`: Content slot type check.
- `<... attr=${...}>`: Attribute slot type check.
- `:binding.modifier=${...}`: Binding, Modifiers and Values type check.
- `:binding.modifier=${...}`: Binding, Modifiers and Values type check.
- `@event-name=${...}`: Event name and handler type check.


#### Template Tag and Properties

This plugin provides

- Auto Completion
- Quick Info
- Goto Definition
- Find References
- Diagnostic
- Slot Value Type Check 

For:

- `<Component>`: Component
- `<custom-tag-name>`: Custom element of Component
- `<... attr=${...}>`: Attribute Slot.
- `.property`: Property assignment
- `:binding="..."`, `:binding.modifier="..."`, `:binding=${...}`: Static Binding.
- `<... ${Binding(...)}>`: Dynamic Binding.
- `@event-name=${...}`: Event, validate event handler parameter type.

Otherwise:
- Validate `:class` modifiers, must be one, and valid class name.
- Check `context` parameter for `:ref`, makesure it's provided.
- Validate `:ref=${...}` and `:ref.el=${...}` to makesure it binded to a right component or element.
- Ensure binding `:show`, `:enable` can only be applied to `HTMLElement``.
- Ensure binding `:src` can only be applied to `HTMLMediaElement``.
- Ensure `of` parameter of `<for of=${...}>` be iterable, and render function of `<for>${(item) => html`...`}</for>` be static, and it must render a unique typeof render result.
- Not allow html & svg template computering, like `clone`, `concat`, `join`, and not allow to visit it's `type` and `strings` and `values`.
- `:transition=${draw()}` can only work on path / line ..., these `SVGGeometryElement` element. And also infer modifiers type.
- `:transition.local` get warning of attached element cant be added or removed directly.
- `defineNamedBinding` must also export binding class.
- Warn if `renderFn` parameter doesn't bind a context.
- `:slot` must bind a fixed value, not variable.


#### Component Class

For Component Class, it provides:

- Limit writable of non `@input` public properties.
- Validate circular references.
- Ensure `onCreated`, `onReady`, `onUpdated`, `onConnected`, `onDisconnect` call `super.onXXX()`.
- If overwrites protected methods `onCreated`, `render`, should also be protected.
- Prevent writable operations inside `render`, `@watch`, `@computed`, `Watcher.watchXXX(...)`, `compute(...)`.
- If binded global listeners, ensure unbind it in `onDisconnected`.
- If Registered watchers by `Watcher.watchXXX(...)` and uses global data, ensure unwatch it in `onDisconnected`.


#### Miscs
- Auto Complete `=$` to become `=${}`.
- `render()` must transfer `context` parameter if uses `this` in template.
- If a binding needs to implement `Part``, must implement both methods.
- Check `:ref=...` proeprty, be component or element.
- Prompt for type may should be wrapped by `Observed<>`, normally from broadcast.
- Warn if super parameter is `Observed<>`, and overwritten one is not.


#### Template
- `<lu:if ...>`: can narrow variable types for if content. and several other `lu:` tags



#### Warn about

- name property can't be tracked: `this.items.map(({name}) => {...})`



# More About

This plugin was inspired by <https://github.com/mjbvz/vscode-lit-html>, and <https://github.com/runem/lit-analyzer>.
