# Security Policy

ShadowGuard is provided as-is as an archived open-source resource. There is no
supported-version matrix, security SLA, guaranteed acknowledgement, remediation
timeline, coordinated-disclosure service, or promise of future releases.

## Operator responsibility

Each installation operator is responsible for:

- restricting network access and terminating TLS at a hardened reverse proxy;
- protecting Supabase service keys, OAuth credentials, encryption keys, source
  keys, export secrets, backups, logs, and user data;
- keeping the operating system, containers, Node.js dependencies, Supabase
  stack, reverse proxy, and optional integrations updated;
- monitoring advisories and logs, testing backups and restores, revoking
  compromised credentials, and responding to incidents;
- validating organization-scoped RLS and role/MFA behavior after local changes.

Never expose `SUPABASE_SERVICE_ROLE_KEY` or any other server secret through a
`NEXT_PUBLIC_` variable, browser bundle, public issue, screenshot, or log.

## Vulnerability reports

If the repository host offers private security advisories, a sanitized report
may be submitted there. Do not include live credentials, production records, or
personal information. Submission does not create a response or remediation
commitment.

Fork maintainers and downstream operators should publish their own disclosure
channel and supported-version policy because they control the deployed code and
infrastructure.

## Security boundaries

The application includes organization-scoped RLS, role checks, MFA gates,
same-origin mutation checks, rate limiting, credential encryption, source-key
validation, and audit logging. These controls do not replace secure deployment,
independent review, monitoring, backups, incident response, or legal and
regulatory analysis.
