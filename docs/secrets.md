# Managing secrets

Sensitive config (API keys, DB credentials, webhook secrets) lives in **Google Secret Manager**, not as plaintext Cloud Run env vars. Non-sensitive config (site URLs, feature flags, queue names) stays as regular Cloud Run env vars — see the classification list in the deploy pipeline plan for which is which.

Secrets are named `prod-<VAR_NAME>` and `staging-<VAR_NAME>`, one Secret Manager secret per env var per environment (e.g. `prod-RESEND_API_KEY`, `staging-RESEND_API_KEY`).

## Adding a brand-new secret

1. Create the secret and its first version:
   ```
   gcloud secrets create prod-MY_NEW_SECRET --replication-policy=automatic
   printf '%s' 'the-actual-value' | gcloud secrets versions add prod-MY_NEW_SECRET --data-file=-
   ```
   (repeat with `staging-MY_NEW_SECRET` and the staging value, if the app needs it there too)

2. Grant the Cloud Run runtime service account access to read it:
   ```
   gcloud secrets add-iam-policy-binding prod-MY_NEW_SECRET \
     --member="serviceAccount:926730476454-compute@developer.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"
   ```

3. Wire it into the running service (maps the Cloud Run env var name to the secret):
   ```
   gcloud run services update todds-threads-service \
     --region=europe-west4 \
     --update-secrets=MY_NEW_SECRET=prod-MY_NEW_SECRET:latest
   ```
   Do the same against `todds-threads-staging` with the `staging-` secret if needed there too.

All three steps can also be done from the console: **Secret Manager → Create Secret**, then on the Cloud Run service's **Edit & Deploy New Revision → Variables & Secrets** tab, add a secret reference.

## Rotating an existing secret

Add a new version, then redeploy (or just wait — `:latest` is resolved at each new revision, so the next deploy picks it up automatically):
```
printf '%s' 'the-new-value' | gcloud secrets versions add prod-RESEND_API_KEY --data-file=-
gcloud run services update todds-threads-service --region=europe-west4 --no-traffic --revision-suffix=rotate-$(date +%s)
```
(or simply run the next normal deploy — it will pick up `:latest` for every secret it references)

## Viewing what's currently wired up

```
gcloud run services describe todds-threads-service --region=europe-west4 \
  --format="yaml(spec.template.spec.containers[0].env)"
```
Entries with `valueFrom:` are Secret Manager references; entries with a plain `value:` are non-sensitive config.
