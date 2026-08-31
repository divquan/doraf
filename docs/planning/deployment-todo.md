# Deployment TODO

Status: Open
Last updated: 2026-08-31

This list records deployment work that is still required after the F-01
application changes. The bounded job entrypoint is implemented; these items
must be completed in the selected Google Cloud project before claiming
serverless readiness.

## F-01 — Scheduled execution

- [ ] Select the Google Cloud project, region, service accounts, Artifact
      Registry repository, and Cloud Run maximum-instance limits.
- [ ] Build and publish one immutable API image containing `dist/job-main.js`.
- [ ] Create Cloud Run Jobs using the image command `node dist/job-main`.
- [ ] Configure each scheduled job with:
      `NODE_ENV=production`, `WORKER_ENABLED=true`,
      `WORKER_EXECUTION=run-once`, and one allowlisted `JOB_NAME`.
- [ ] Inject production secrets through Secret Manager, including the Supabase
      pooled runtime database URL and the direct migration URL where needed.
- [ ] Create Cloud Scheduler triggers for the bounded jobs:
      `payment-initialization`, `payment-reconciliation`,
      `refund-reconciliation`, `withdrawal-reconciliation`, `lease-recovery`,
      and `invariant-audit`.
- [ ] Protect Cloud Run Job execution with a dedicated scheduler service
      account and Cloud IAM. Do not expose the job command as a public HTTP
      mutation endpoint.
- [ ] Set timeout, retry, concurrency, and failure-notification policies for
      each job. A failed job must be retried and alerted, not treated as a
      successful empty pass.
- [ ] Run a production-like test that terminates the API process after a
      transaction and verifies the scheduled job completes the durable work.

## Immediate outbox execution — F-02 deployment decision

- [ ] Choose either a Cloud Tasks/Pub/Sub trigger for immediate outbox work or
      a minimum-capacity continuously running Redis worker.
- [ ] If Redis remains the queue, provision managed Redis with TLS, ACLs,
      persistence, high availability, monitoring, and an explicit recovery
      runbook.
- [ ] If a native queue is selected, publish only the outbox ID and claim
      token, authenticate the handler with the platform identity, and verify
      duplicate delivery is harmless.

## Release evidence

- [ ] Capture successful Cloud Run Job executions and failure/retry logs.
- [ ] Confirm the API service has `WORKER_ENABLED=false`.
- [ ] Confirm no continuously running worker is required for scheduled
      reconciliation when the native queue trigger is selected.
- [ ] Record the deployed image digest, schedules, service accounts, database
      connection limits, and owners in the launch runbook.

