# Behaviours

How an Agent works: guidance it follows. One Markdown file per behaviour; the file name
(no `.md`) is its id. Facts are in `../facts/`, tools in `../tools/`; the header and how the
brief is built are in [tools/README.md](../tools/README.md#the-header).

The user's own `~/ronin/behaviours/<id>.md` replaces the stock file of that id whole, or adds
a new one; it lives outside what an update replaces, so it survives updates.

A behaviour never lists its tools: a tool names the behaviours it serves (`serves:`), and the
brief lists it under each. A behaviour may name a tool in its guidance.
