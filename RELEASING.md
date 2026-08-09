# Releasing

Publishing is triggered by a GitHub release, not by running `npm publish` by
hand. The workflow builds from a clean checkout, so what ships is what is on
`main` — never what happens to be in someone's `dist/`.

## Before the first release

**Decide whether the repository is public.** While it is private:

- `repository`, `homepage` and `bugs` in `package.json` point at a URL that
  404s for everyone who installs the package.
- The documentation site cannot deploy — GitHub Pages needs a paid plan for
  private repositories. The Docs workflow skips itself rather than failing.
- npm provenance is skipped. Provenance links a package to the workflow run
  that built it, which only means anything if the source can be inspected, so
  npm rejects it from a private repository.

None of these block publishing. They just mean the package page has dead links
and no provenance badge. Both workflows pick the capability up automatically
when the repository becomes public — there is nothing to change.

## The publish token

A granular access token at npmjs.com/settings/~/tokens, configured as:

| Field | Value |
| --- | --- |
| Packages and scopes | Read and write, on the **scope** — not a package |
| Organizations | No access |
| Allowed IP ranges | Empty |
| **Bypass two-factor authentication** | **Enabled** |

Two of those are easy to get wrong and both cost a failed release.

**Scope, not package.** A granular token can only select packages that already
exist, so a package being published for the first time will not appear in the
list. Selecting the scope covers packages created inside it later.

**Bypass 2FA.** If the npm account has two-factor authentication on — and it
should — CI cannot answer the prompt, so the token has to be marked as allowed
to skip it. Without it the build passes, provenance is signed and logged, and
the very last call fails:

```
npm error code E403
npm error 403 Forbidden - PUT https://registry.npmjs.org/@octomate%2fpayroll-icons
  Two-factor authentication or granular access token with bypass 2fa enabled
  is required to publish packages.
```

Nothing is published when this happens, so the version number is not burned.
Fix the token, update the secret, and re-run the failed job:

```bash
gh secret set NPM_TOKEN --repo AndyLiu0427/payroll-icons
gh run rerun <run-id> --failed --repo AndyLiu0427/payroll-icons
```

`gh run rerun` may print "cannot be rerun" and re-run it anyway. Check the run,
not the message.

**Checking the scope is a dead end.** `npm access` and `npm org` both hit
organisation endpoints this token is deliberately not granted, so a 403 there
is expected and says nothing about publish permission. The token's own settings
page is the only authority.

## Every release

1. **Preflight.** Publishes nothing; checks the token, the scope, and the
   tarball contents. It cannot detect a missing 2FA bypass — that only surfaces
   on the real publish.

   ```bash
   gh workflow run publish.yml --repo AndyLiu0427/payroll-icons
   gh run watch
   ```

2. **Bump the version** in `package.json` and move the `## [Unreleased]`
   heading in `CHANGELOG.md` to the new version.

   While the major version is 0, a mark's drawing may change in a minor
   release. The component API may not — that follows semver from the start.

3. **Commit and push.** CI must be green; it runs the same build, typecheck,
   lint and smoke test the publish workflow will.

4. **Cut the release.** This is the irreversible step, and creating the release
   *is* the publish — there is no separate confirmation. npm allows unpublish
   only within 72 hours, and the version number is burned either way.

   ```bash
   gh release create v0.1.0 \
     --repo AndyLiu0427/payroll-icons \
     --title "v0.1.0" \
     --notes-file CHANGELOG.md
   ```

5. **Verify what landed.**

   ```bash
   npm view @octomate/payroll-icons version
   npm view @octomate/payroll-icons dist-tags
   ```

## What the pipeline checks

`npm run smoke` runs in CI and again in `prepublishOnly`. It resolves the built
package the way a consumer will rather than the way a permissive bundler does,
which is how two release blockers reached a green build once already:

- every path in the `exports` map exists on disk
- no extensionless relative imports — Node ESM and strict-ESM bundlers both
  reject those in a `"type": "module"` package
- `sideEffects` still lists the CSS, so bundlers cannot drop `animate.css`
- every entry point imports under real Node ESM
- the metadata npm renders on the package page is present

`npm test` pins the geometry. The build checks that masters are *well formed*;
only the snapshot catches a drawing that *changed*. A refactor that moved a
curve by 0.05 units would otherwise pass every gate and ship — verified by
making exactly that edit and watching the snapshot fail.

`npm run icons` additionally enforces the icon system's own rules, so a
composition that breaks one fails the release rather than shipping.

## If a release goes wrong

Within 72 hours, `npm unpublish @octomate/payroll-icons@<version>` removes it.
The version number stays burned — publish a patch, do not reuse it.

After 72 hours, deprecate instead:

```bash
npm deprecate @octomate/payroll-icons@<version> "Broken build, use <newer>"
```
