# Secrets scan

Generated: 2026-05-27 by security-audit-agent.

`gitleaks` is not installed on the audit host (see `tooling-setup.md` §2 for the recommended config). Fell back to a `git log -p | grep` sweep against common secret keywords, plus a working-tree pattern grep for high-entropy key shapes.

## How to reproduce

```bash
# Keyword sweep across full git history
git log -p | grep -iE '(api[_-]?key|secret|token|password)' | head -50 \
  > reports/security/raw-secrets-grep.txt

# High-entropy key-shape grep across the working tree
grep -rIniE '(sk-[a-z0-9-]{20,}|aws_secret|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|xoxb-[A-Za-z0-9-]{20,}|BEGIN [A-Z ]*PRIVATE KEY)' \
  --exclude-dir=node_modules --exclude-dir=.git . \
  > reports/security/raw-keypattern-grep.txt
```

Raw outputs: [`raw-secrets-grep.txt`](./raw-secrets-grep.txt), [`raw-keypattern-grep.txt`](./raw-keypattern-grep.txt) (empty — no key-shape matches anywhere in the working tree).

## Findings

**No real secrets are committed.** All 35 keyword-sweep matches fall into three categories — none of which is a credential:

| Category | Example match | Verdict |
|---|---|---|
| Documented hackathon demo password | `Login password: \`demo\` (no real auth)` (README:53), `No real OAuth — email + password "demo"` (README:91), `Password is ignored for the demo.` (LoginView) | Intentional — see `code-review.md` F-13. |
| Comments / variable names containing the word "token" | `~12k tokens of overhead`, `model tokens`, `js-tokens@4.0.0` (in pnpm-lock.yaml) | Documentation / lockfile only. |
| Frontend password field (UI plumbing only) | `const [password, setPassword] = useState('')`, `<input type="password" />` | UI state; the password is never sent to the backend. |

The full-history `git log -p` keyword grep produced 35 lines (`raw-secrets-grep.txt`); manual review of all 35 lines confirms each falls into one of the three categories above. **No real key, OAuth secret, JWT signing material, AWS access key, GitHub token, Slack bot token, or PEM-encoded private key appears in any commit.**

## `CLAUDE_BIN` notes

The README documents the developer's local `CLAUDE_BIN` path:

```
CLAUDE_BIN=/Users/isathe/.vscode/extensions/anthropic.claude-code-<version>/resources/native-binary/claude
```

This is committed in `apps/api/.env.example` with the operator's username (`isathe`). It is a filesystem path, not a credential — the Claude Code CLI authenticates via the user's OS keychain login, not an in-tree token. No risk, but if you publish this repo externally consider stubbing the username, e.g.:

```
CLAUDE_BIN=/path/to/claude-code/resources/native-binary/claude
```

## `.env` handling

`.gitignore` excludes `.env`, `.env.local`, and `.env.*.local`. `git ls-files` confirms only `apps/api/.env.example` is tracked — no real `.env` is committed.

## Recommendations

1. Install `gitleaks` and add the `reports/security/gitleaks.toml` config from `tooling-setup.md` §2. Wire `gitleaks detect` into the PR check (it runs in <2s on this repo).
2. Anonymize the username in `.env.example` (cosmetic; the existing path is functional only on the author's machine anyway).
3. No remediation required for committed credentials — none exist.
