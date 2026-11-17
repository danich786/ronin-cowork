# Netlify
- **label:** Netlify
- **blurb:** A site or app on Netlify: the live page, previews, traffic and forms, then its database, repos, work and documents.
- **order:** 10
- **kinds:** site, app
- **integration:** netlify
- **drawing:** https://claude.ai/artifact/5DzaJKuVZu2jJoPP9G1JyC

The Netlify block first, then the Workspace's own parts. A block holds only what
the Workspace uses: no Netlify site linked, no Netlify block; no database, no Database block.
No credits entry: Netlify's API gives no credits-left figure to read.

## blocks

### Netlify
- **source:** integration netlify
- **holds:** The site itself, read from Netlify each time the canvas opens.
- **entries:** page or app (up, and whether the last change went out), preview (the latest per PR, and the latest drafts: state and link), traffic (visitors and errors, today), forms (only if the site has one: new messages)
- **read:** netlify sites --workspace {workspace}; netlify previews --workspace {workspace}; netlify traffic --days 1 --workspace {workspace}; netlify forms --workspace {workspace}

### Database
- **source:** integration
- **holds:** Only the databases this site uses, from whichever provider: none, one or several.
- **entries:** database (provider and health)

### Repos
- **source:** live repos
- **holds:** The code for this site.
- **entries:** repo (what it holds)

### Work items
- **source:** live items
- **holds:** Epics and items in this Workspace, open ones first.
- **entries:** epic or item (status and who holds it)

### Documents
- **source:** live documents
- **holds:** Plans and documents the Agents keep for this site.
- **entries:** plan or document (what it covers)

### Other services
- **source:** typed
- **holds:** Anything outside Ronin the site depends on, added by an Agent or a person.
- **entries:** service (one line; who changed it and when)
