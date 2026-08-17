# Vendored code

The `.js` files in this folder are the built output of
`@rakz-app/mns-parser` **0.1.0** (MIT, same author/project), copied here so
the `mns` tool is self-contained — no npm install, no network, just Node.

To update: build mns-parser, then copy `dist/{index,parse,serialize,types,bridges}.js`
over these files and bump the version above.
