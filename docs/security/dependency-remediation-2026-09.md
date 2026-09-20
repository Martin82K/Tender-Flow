# Dependency advisory remediation — September 2026

The 2026-09-20 npm audit reported seven affected dependency entries, including
transitive effects, originating in three packages. The targeted patch updates:

| Package | Previous | Patched | Affected use |
| --- | --- | --- | --- |
| Vitest and its internal packages | 4.1.0 | 4.1.11 | Development test runner and mocker |
| Hono override | 4.13.0 | 4.13.5 | Transitive Google GenAI / MCP SDK dependency |
| Joi override | 18.2.1 | 18.2.5 | Development `wait-on` configuration validation |

Upstream sources:

- [Vitest redirect mock advisory](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9)
- [Hono security release](https://github.com/honojs/hono/releases/tag/v4.13.5)
- [Joi custom-message prototype advisory](https://github.com/hapijs/joi/security/advisories/GHSA-6w3j-5fw6-r9vr)

## Scope and supply chain

Only the three patch-version families change. Existing unrelated versions,
peer dependencies, application permissions, persistence, tenant boundaries and
migration state remain unchanged. Rollback consists of reverting this dependency
commit, with the previous advisories consequently returning.

Registry metadata was checked against the upstream repositories and release
history, including maintainers, tarball integrity and available provenance.
No compromise report for these selected releases was identified in the reviewed
upstream sources; this is not a guarantee of absence. Vitest and Hono publish
provenance attestations; Joi has registry signatures but no provenance attestation
in its selected-version metadata.

npm 10.9.8's normal lockfile recalculation encountered an Arborist `edgesOut`
error. A temporary legacy-peer resolution was used only to obtain updated package
metadata; its peer removals and unrelated changes were discarded. The final
lockfile retains the existing graph and is validated by ordinary `npm ci` without
legacy-peer flags. No npm configuration or CI security gate was weakened.

## Validation

Local evidence is for this working diff against `f4d5acc8`:

- New bounded child-process regressions in
  `tests/rootTransitiveDependencies.regression.test.ts` reproduced Joi prototype
  mutation and Hono fragment-query parsing on the old installed versions (RED),
  and passed on the patched versions (GREEN).
- Existing dependency version guards, transitive runtime regressions and
  `mcpRemoteServer`, `mcpNodeHandler`, `mcpDeploymentBoundary` tests passed after
  their expected security versions were updated: 133 tests total.
- Actual `wait-on` TCP readiness and invalid-resource handling passed with Joi
  18.2.5 on a local synthetic server.
- `npm ci --ignore-scripts` passed with standard peer resolution.
- `npm audit --json`: zero known vulnerabilities at verification time.
- `npm audit signatures`: 854 registry signatures and 143 attestations verified.

The complete GitHub Quality Checks run and independent PR security review remain
the merge gates. Existing deprecation notices for unchanged transitive packages
are distinct from npm audit vulnerability findings.
