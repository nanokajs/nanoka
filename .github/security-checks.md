# Security checks

The `Security` workflow runs on pull requests, pushes to `main`, manual dispatch,
and Sundays at 14:37 UTC (23:37 Asia/Tokyo). Scheduled runs use the default
branch and start only after the workflow is merged. GitHub may delay or drop
scheduled runs under load, and disables schedules in public repositories after
60 days without repository activity. Completion before Monday 08:00 JST is not
guaranteed. Check Actions for the latest completed run rather than assuming it ran.

## Dependency audit

The committed pnpm workspace lockfile is checked against the public npm registry,
including development and optional dependencies. No project dependencies are
installed and no project lifecycle scripts run in this job. Package names and
versions are sent to the registry's advisory API; source code is not sent.
The package manager is pnpm 9.15.9.

Any low, moderate, high, or critical finding fails the job. The log includes
advisory details and the job summary includes severity counts. The error title
`Dependency vulnerabilities detected` means a completed scan found issues;
`Dependency audit could not complete` means a registry, command, or report error.
Setup failures/timeouts also mean incomplete coverage. A failed scan is never a
clean security result. This CI job does not modify dependencies, suppress findings,
or ignore registry errors. Remediation runs separately as described below.
Only dependencies represented in the committed lockfile are covered; generated
projects, unlocked fixtures, system packages, and vulnerabilities without a
published advisory are outside this check.

## Code scanning

CodeQL scans actions, javascript-typescript with the
`security-extended` query suite and `build-mode: none`. No application build or
deployment is invoked. Results are uploaded to GitHub code scanning; database
upload is disabled. A successful analysis/upload is not proof of zero alerts:
review the repository Security tab and the CodeQL pull request check separately.
Generated code that is absent from the checkout and unsupported languages are
outside this scan. This is static analysis, not a production penetration test.

The workflow uses SHA-pinned upstream Actions, GitHub-hosted runners, read-only
checkout with no persisted credentials, and no deployment/release secrets.
Only the CodeQL job gets `security-events: write`, for result upload. Dependabot
keeps Action pins and package dependencies under review through update PRs.

Repository Security settings (Dependabot alerts/security updates, secret scanning,
push protection, and CodeQL default setup) are managed separately. This workflow
does not change those settings or grant new account/app access. Before enabling
CodeQL default setup later, reconcile it with this advanced workflow to avoid
overlapping configurations. Secret scanning is outside this workflow's scope.

## Remediation pipeline

The Codex automation for this repository uses
[`nanoka-security-remediation`](../.agents/skills/nanoka-security-remediation/SKILL.md)
to collect current public advisories, assess Nanoka's actual exposure, make scoped
fixes, run checks, and open PRs against `main`. Scheduling belongs to the Codex
automation attached to its chat, not to this CI workflow. The workflow alone
does not enable that automation. Existing Dependabot PRs are checked for overlap.
Merging, releases, and production changes remain outside the automation.

For a repeatable input report, put the repository-pinned pnpm on PATH and run:

```sh
node scripts/collect-security-report.mjs > /tmp/nanoka-security-report.json
```

Exit codes: **0** = no actionable npm findings, **1** = findings, **2** = incomplete
inventory/audit (including wrong pnpm, network failures, or malformed responses).
Read the JSON even on nonzero exit. The collector does not install dependencies
or execute lifecycle scripts. It records revision, lockfile hash, declared
dependencies/peers/templates and workflow Action/Node inputs, without environment
variables or credentials. Do not commit generated reports.

Public advisory bodies, peer/template version ranges, Node.js security releases,
GitHub Actions, and Cloudflare Workers/tooling are reviewed separately by the
agent using official sources. `pendingReview` deliberately lists that work even
when the npm audit finds nothing. Missing sources or tests must stay visible in
the PR/report; they are never treated as a clean scan. The scheduled task reports
new actionable results and failures, and stays quiet on unchanged non-actionable
results. Regression tests for report classification run in CI via
`pnpm test:security-report`.

## References

- [CodeQL workflow options](https://docs.github.com/en/code-security/reference/code-scanning/workflow-configuration-options)
- [CodeQL Action permissions and supported versions](https://github.com/github/codeql-action)
- [npm audit](https://docs.npmjs.com/cli/v11/commands/npm-audit/)
- [pnpm audit](https://pnpm.io/10.x/cli/audit)
- [GitHub scheduled events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
