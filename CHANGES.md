# Changes


# 1.3.1

- Ignore `${}` within html comments.
- Ignore mirroring lib ts files.


# 1.3.0

- html`...`, when input the last '`', vscode will auto complete it to '``', and we will delete one.
- Support html syntax and the only `<template>` returned diagnostics.
- Fix closing a tag in html template cause indentation loss.
- Support component, property, binding renaming.
- New typescript mirror to support full typescript language syntaxes within template.


# 1.2.0

- Supports `<lu:cache>`.


# 1.1.4

- Supports `enter` and `leave` modifier for `:transition`.


# 1.1.3

- Better tabs completion when editing HTML template.


# 1.1.2

- Prefers importing components or bindings from relative path.


# 1.1.1

- Removes support for `:slot`.


# 1.1.0

- When input `<div` and enter, will add an additional tab indent for attributes.


# 1.0.23

- Fix a issue which cause `<div ${...}>; complete as attribute name.


# 1.0.22

- Fix conflicts with Vue Official.