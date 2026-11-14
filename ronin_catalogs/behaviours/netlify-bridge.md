# Netlify bridge
- **seed:** Netlify hosts the Workspace's sites: `netlify` for its sites, deploys, traffic, forms and variables; `preview` for a pull request's preview link.
- **when:** integration:netlify
- **depth:** full
- **mcp:**
- **order:** 24

Netlify hosts this Workspace's site. It builds a preview for every pull request and publishes
the production branch when a PR merges. The `netlify` bridge is the short way to read it: it
fills in the account and the site linked to your Workspace, and answers in a few lines.
Netlify's own CLI and API still work for anything it doesn't cover.

- Change the site the usual way: a PR, then `preview` puts its preview link in your Documents.
  It goes live when the person you work for says ship and the PR merges.
- `netlify sites`: is it live, and did the last deploy fail? A failed build also shows red on
  the PR's checks.
- `netlify env`, `netlify env set <KEY> <value> --context <c>` (or `--branch <b>`): the
  variables a build reads. A change applies from the next deploy.
- `netlify forms [<form>]`: what visitors sent through the site's forms.
- `netlify traffic`: views and visitors, when Netlify Analytics is on for the site.
- `netlify deploy <dir>`: only for a Workspace with no repo. Without `--prod` it is a draft
  with its own URL. A site that builds from a repo changes by PR, not by this.
- `--site <name>` reaches another site on the account; without it, the Workspace's.
- Which data a preview uses (production's, one staging database, one per PR) is a choice for
  the person you work for: name the forks and take the one they pick.
