# Netlify

Put a site on Netlify: a preview for every pull request, the site live when one merges. You
do the clicks; the Agent gives you one step at a time and waits for each. Its brief carries
the Netlify bridge when Netlify is on for its Workspace, and `netlify sites` says what is
still missing.

## 1. The site

1. Go to app.netlify.com and sign up with GitHub.
2. Choose **Add new project → Import an existing project → GitHub**.
3. When GitHub asks, install the Netlify app on the repository's owner, for that repository
   only.
4. Pick the repository, then set the branch to deploy (the production branch), the build
   command (empty for a static site) and the publish directory (`.` for the repository's top).
5. Press **Deploy**, and tell the Agent the site name Netlify gives (`<name>.netlify.app`).

## 2. The token

The Agent runs `secret ask netlify-auth-token --for "Netlify personal access token"`, and a
paste field opens on its tile. In Netlify make the token under **User settings → Applications
→ Personal access tokens**, then paste it there. It never goes in chat or a `.env`.

## 3. The link

Netlify on the Workspace with the site name links them; until then the Agent names the site
with `--site <name>`.

## 4. The domain

The Agent adds your domain and its `www` to the site through Netlify's API, with the token.

## 5. DNS

At your domain's registrar, set two records:

| Type | Name | Value |
|---|---|---|
| A | `@` (the bare domain) | `75.2.60.5` |
| CNAME | `www` | `<name>.netlify.app` |

Netlify then issues the HTTPS certificate by itself.

## 6. Done

When `curl -sI` shows both names answered by Netlify, the Agent says so. A site's old host
comes down only when you take it down.
