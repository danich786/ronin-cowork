# Facts

What is true about the user and the Agent's situation, printed in the brief from the work
record. One Markdown file per fact; the file name is its id. A fact has a `line:` (the line
the brief prints, with `{record.path}` placeholders; `{, x}` prints `, <x>` only when x is set),
or a body with placeholders, or both. A fact whose placeholders all come out empty is not
printed. The header is in [tools/README.md](../tools/README.md#the-header).

The user's own `~/ronin/facts/<id>.md` replaces the stock file of that id whole, or adds one.
