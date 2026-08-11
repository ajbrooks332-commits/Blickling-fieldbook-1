# Security policy

## Supported branch

`main` is the supported deployment branch. Dependency and GitHub Actions updates are monitored by Dependabot and every change is verified by CI.

## Reporting a vulnerability

Do not open a public issue containing credentials, personal data, estate security information or reproduction details for an exploitable vulnerability. Report it privately to the repository owner, including the affected route/version, impact and the minimum reproduction steps.

## Deployment controls

- Keep `DATABASE_URL`, `SESSION_SECRET`, `SETUP_SECRET` and storage configuration in Replit deployment secrets. Never commit their values.
- Use a unique, random `SESSION_SECRET` of at least 32 characters.
- Use a unique, random `SETUP_SECRET` of at least 24 characters, remove it after initial setup and republish.
- Publish behind HTTPS. Production cookies are `Secure`, `HttpOnly`, `SameSite=Lax` and expire after 12 hours.
- Restrict database and Replit project access to authorised maintainers, and maintain tested backups.
- Treat exported CSV files and cached offline records as operational estate data.

## Application controls

The API reloads the active user from PostgreSQL for every authenticated request, scopes records to the user's estate, revokes sessions after security-sensitive account changes, validates mutation origin/header, rate-limits authentication, validates all write inputs and keeps uploaded images private. Administrators can archive records; operational records are not hard-deleted by the UI.
