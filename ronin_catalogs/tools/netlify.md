# netlify
- **seed:** Netlify sites, deploys, traffic, forms and variables, with the Workspace's token
- **when:**
- **depth:** seed
- **serves:** netlify-bridge
- **order:** 86

## Usage

**Ronin Services bridge, the worked example (optional).** `netlify sites`, `traffic [--days N]`, `forms [<form>]`, `deploy [<dir>] [--prod]` (a Workspace with no repo), `env` and `env set <KEY> <value> [--context <c>] [--branch <b>]` answer in a few lines for the site linked to the caller's Workspace (or `--site`). The Services part `netlify` reads `NETLIFY_AUTH_TOKEN` from `~/ronin/services_secrets/netlify-<campaign>.env`; with something missing it says what, exit 4; without the part it says to use Netlify's own API or CLI. Any other command goes to Netlify's CLI when installed. Taught by the Integrations brief; `netlify --help`.
