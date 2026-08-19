# Validation engine

Phase 7 answers: **does this exact repository revision compile and pass its existing tests?**

`validationEngineVersion` is `"1"`. Profile: `STANDARD_LOCAL@1`.

Identity:

`repositoryRevisionId + revisionContentHash + engineVersion + sandboxImageDigest + profile`

Completed runs are reused. Historical results are immutable.

## Flow

```
RepositoryRevision
  → verify artifact + content hash
  → isolated sandbox
  → install (policy)
  → build
  → test
  → destroy sandbox
  → persist ValidationRun
```

ORIGINAL revisions rematerialize the Git SHA. GENERATED revisions load the Phase 6 artifact store. Missing generated artifacts never fall back to GitHub.

## Commands

ChainPort owns the command list. Repositories cannot submit shell.

Foundry: optional `git submodule update --init --recursive` (install network), `forge build`, `forge test`.

Hardhat: lockfile install with `--ignore-scripts`, then `hardhat compile` / `hardhat test` via `node node_modules/hardhat/internal/cli/cli.js`.

No Makefile, no README scripts, no `forge script --broadcast`.

## Outcomes

| Outcome         | Meaning                                              |
| --------------- | ---------------------------------------------------- |
| `PASSED`        | Build passed and executed tests passed               |
| `FAILED`        | Build or executed tests failed                       |
| `PARTIAL`       | Local validation ran; required network tests skipped |
| `UNSUPPORTED`   | Framework/runtime/install scripts not allowed in v1  |
| `INFRA_FAILURE` | Sandbox/platform failure                             |

`BUILD_FAILED` / `TEST_FAILED` complete the run. They are repository results, not platform crashes.

## Regression

When original and generated both have completed runs:

- original PASS + generated PASS → `NO_REGRESSION`
- original PASS + generated FAIL → `REGRESSION_DETECTED`
- original FAIL + generated FAIL → `BASELINE_ALREADY_FAILING`
- PARTIAL / UNSUPPORTED / INFRA → `INCONCLUSIVE`
