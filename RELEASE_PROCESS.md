# UtilX Release Process

End-to-end steps for shipping a change from local edits to production. Pipeline:
`development` -> `staging` -> `main`. Netlify auto-deploys each branch to its own preview URL,
and `main` to production (utilx.tools). Each stage has its own isolated Turso database.

## 1. Make your edits

Edit files directly in the local `devtoolbox` folder (this is a real git clone of
`sksels/utilx`, checked out to the `development` branch by default).

## 2. Push to development

```powershell
cd "C:\Users\FusionGamingMasterPC\OneDrive\Desktop\Website\devtoolbox"
.\release.ps1 -Branch development -Message "CR#2: keyboard shortcuts + shareable URLs"
```

What this does: fetches and syncs `development` with origin, shows you a `git status --short`
diff of exactly what changed, asks for `y/n` confirmation, then commits and pushes.

If it's the very first time using git on this machine and it complains about identity:

```powershell
git config --global user.email "you@example.com"
git config --global user.name "Your Name"
```

then re-run the `.\release.ps1` command above.

## 3. Visual check on the development preview

Open the `development` branch's Netlify preview URL and click through whatever changed.
No command for this step — it's manual review.

## 4. Promote development -> staging

On GitHub (github.com/sksels/utilx):

- Switch branch dropdown to `development`.
- Either merge directly into `staging`, or open a PR: base `staging`, compare `development` ->
  "Create pull request" -> "Merge pull request".

This push triggers the CI workflow automatically. Check the **Actions** tab for a green run
(syntax check + `node --test` regression suite).

## 5. QA on staging

Open the `staging` branch's Netlify preview URL (separate DB from dev and prod) and test as
needed.

## 6. Promote staging -> main

On GitHub:

- Go to `github.com/sksels/utilx/compare/main...staging` (base: `main`, compare: `staging`).
- Click **Create pull request**, confirm the CI check passes on the PR, then **Merge pull
  request**.

Always use a PR here, not a direct merge — the PR is what triggers the CI check as a gate
before production.

## 7. Production deploy

Automatic — Netlify redeploys `utilx.tools` from the new `main` commit. No manual step.

## 8. Sanity-check production

Spot-check the live site. Quick way to check specific files deployed correctly:

```powershell
# from any machine with internet, e.g. in a browser or via curl
curl -I https://utilx.tools/tools/lib/cron.js
```

Look for `HTTP/2 200` and the right `content-type`.

## 9. Tag a GitHub Release (optional, do this after step 6 is actually merged)

- Go to `github.com/sksels/utilx/releases/new`.
- Tag: something like `cr2` (create new tag on publish).
- Target: `main`.
- Title: e.g. "CR#2 — Keyboard Shortcuts & Shareable URLs".
- Click **Generate release notes**, review, then **Publish release**.

Don't create the release before the code is actually merged to `main` — the release just tags
whatever commit is on the target branch at that moment.

## 10. Update the backlog sheet

Flip the shipped item(s)' Status column to "Shipped" in `utilx-backlog.xlsx`.

---

## Quick reference: all commands in order

```powershell
cd "C:\Users\FusionGamingMasterPC\OneDrive\Desktop\Website\devtoolbox"
.\release.ps1 -Branch development -Message "<describe the change>"
# ... visual check on development preview ...
# ... merge development -> staging on GitHub (triggers CI) ...
# ... QA on staging preview ...
# ... open PR staging -> main on GitHub, confirm CI, merge ...
# ... sanity-check production ...
# ... optionally create a GitHub Release tagging main ...
```
