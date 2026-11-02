# Fork notes

This fork restyles the management panel and otherwise tracks
[upstream](https://github.com/router-for-me/Cli-Proxy-API-Management-Center). `main` is the latest
upstream release tag plus a stack of fork commits, one per area:

```bash
git log --oneline <upstream-tag>..main
```

## Rules that keep syncs cheap

- Change copy in `src/i18n/overrides/<locale>.json`, never in `src/i18n/locales/`. Overrides are
  deep-merged over the upstream strings at startup, so upstream locale updates never conflict.
- Leave upstream files in place even when the redesign stops using them. Deleting them turns every
  upstream edit into a conflict.
- Keep upstream comments, formatting and naming as they are. Change only what the design needs.
- Amend the commit that owns the area (`git commit --fixup=<sha>`, then
  `git rebase -i --autosquash <upstream-tag>`). Fixes that are not about the design get their own
  commit, so they can be sent upstream and dropped from the stack.

## Syncing with upstream

```bash
git fetch upstream --tags
git rebase <new-upstream-tag>
bun install --frozen-lockfile && bun run verify
```

Enable `git config rerere.enabled true` once so repeated conflict resolutions are replayed. When a
commit conflicts, keep upstream's behaviour and reapply only the design on top, then check the
affected pages in a browser.

## Releasing

```bash
git push --force-with-lease origin main
git tag v<upstream-version>-redesign.<n>
git push origin v<upstream-version>-redesign.<n>
```

The tag runs `.github/workflows/release.yml`, which publishes `management.html`. CLIProxyAPI
downloads the latest release within three hours when its `config.yaml` points at this fork:

```yaml
management:
  panel-github-repository: "https://github.com/salman-frs/Cli-Proxy-API-Management-Center"
```
