# External Services and API Keys

Nexforge Studio Manager, as built, does not integrate with any external
service or third-party API. It has no required or optional external
credentials.

| Service | Used for | Required credentials | Where to get them | Required? |
|---|---|---|---|---|
| *(none)* | — | — | — | — |

This is deliberate: the app is a local-first tool, and the "Secrets &
Keys" / "Passwords" / "Database Credentials" features you see in the
Secure Vault are for **storing other services' credentials that you use
in your own projects** (e.g. a client's AWS key, a Postgres connection
string) — the vault itself doesn't call any of those services; it's just
encrypted storage for them.

If a future version adds a real integration (for example, optional email
sending for invoice delivery — see docs/EMAIL_SETUP.md for the
placeholder guidance on that), this file should be updated with that
service's name, purpose, required env var names, and setup steps at that
time. Do not treat anything in this file as implemented until the
corresponding feature actually exists in the codebase.
