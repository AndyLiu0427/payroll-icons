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

**Confirm the npm scope.** `npm access` and `npm org` both hit organisation
endpoints a publish-only token is not granted, so a 403 there is expected and
proves nothing. The authority is the token's own page at
npmjs.com/settings/~/tokens: it must list the scope in `package.json` under
"Packages and scopes" with read and write.

## Every release

1. **Preflight.** Publishes nothing; checks the token, the scope, and the
   tarball contents.

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

4. **Cut the release.** This is the irreversible step. npm allows unpublish
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

`npm run icons` additionally enforces the icon system's own rules, so a
composition that breaks one fails the release rather than shipping.

## If a release goes wrong

Within 72 hours, `npm unpublish @octomate/payroll-icons@<version>` removes it.
The version number stays burned — publish a patch, do not reuse it.

After 72 hours, deprecate instead:

```bash
npm deprecate @octomate/payroll-icons@<version> "Broken build, use <newer>"
```
