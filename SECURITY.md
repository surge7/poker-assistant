# Security Policy

## Supported versions

Only the latest release (`main`) receives security fixes.

## Reporting a vulnerability

Please report vulnerabilities privately — do **not** open a public issue.

Use GitHub's private vulnerability reporting on this repository
(**Security → Report a vulnerability**), or email the maintainer via the
address on the GitHub profile. Include reproduction steps and, if possible,
a minimal example. You will get an acknowledgement within a few days.

## Scope notes

- The app is **fully offline**: no telemetry, no analytics, no remote content
  loading (Capacitor is configured with local assets only). Reports that
  require the app to phone home are out of scope.
- Reports about the development toolchain (Vite dev server, Capacitor CLI,
  test runner) that only affect developers running `npm run dev` locally are
  welcome but treated as low severity; see
  [apps/app/SECURITY_AUDIT.md](apps/app/SECURITY_AUDIT.md) for the current
  known set and reasoning.
- Vulnerabilities in dependencies should be reported upstream; a PR bumping
  the dependency is the fastest fix here.
