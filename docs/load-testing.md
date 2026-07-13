# Load Testing

This project uses Artillery for HTTP load tests. The checked-in profiles avoid
checkout submission, webhooks, admin mutations, imports, Sameday sync, AWB
generation, and payment providers.

The npm scripts run Artillery inside a small Node 22 Docker container because
the local Artillery CLI can hang on newer local Node versions. The first run may
pull the Docker image and install Artillery. To reuse a Docker npm cache volume,
run with `ARTILLERY_USE_DOCKER_NPM_CACHE=1`; leave it off if Docker reports
file read errors.

## Profiles

| Script | Purpose | Default target |
| --- | --- | --- |
| `npm run load:smoke` | Quick read-only sanity check | `http://host.docker.internal:3000` |
| `npm run load:baseline` | Sustained normal browsing load | `http://host.docker.internal:3000` |
| `npm run load:flow` | Realistic funnel shape without creating orders | `http://host.docker.internal:3000` |
| `npm run load:spike` | Sudden product-drop style burst and recovery | `http://host.docker.internal:3000` |
| `npm run load:stress` | Gradual ramp to find the current ceiling | `http://host.docker.internal:3000` |
| `npm run load:stress:catalog` | Public page/catalog rendering ceiling | `http://host.docker.internal:3000` |
| `npm run load:stress:api` | Checkout-adjacent API protection ceiling | `http://host.docker.internal:3000` |
| `npm run load:stress:mixed` | More human-like mixed browsing/checkout reads | `http://host.docker.internal:3000` |

## Local Tests

Start the app first:

```bash
npm run dev
```

Then run:

```bash
npm run load:smoke
```

Then increase gradually:

```bash
npm run load:baseline
npm run load:flow
npm run load:spike
```

Run the stress profile only when you are ready to watch metrics closely:

```bash
npm run load:stress
```

To isolate the bottleneck, run the split stress profiles:

```bash
npm run load:stress:catalog
npm run load:stress:api
npm run load:stress:mixed
```

## Test Another Environment

Use `LOAD_TARGET` to override the target:

```bash
LOAD_TARGET=https://dev.toddsthreads.com npm run load:baseline
```

For a report:

```bash
LOAD_TARGET=https://dev.toddsthreads.com npm run load:smoke:report
```

Reports are written to `artillery-results/`.

## Suggested Sequence

1. Run `load:smoke` locally.
2. Run `load:smoke` against dev.
3. Run `load:baseline` against dev and record p95/p99 latency.
4. Run `load:flow` against dev to exercise checkout-adjacent reads.
5. Run `load:spike` against dev and confirm the app recovers.
6. Run `load:stress` only when you want to find the failure point.

## What To Watch

During a run, keep these dashboards open:

- Cloud Run request latency, 4xx/5xx rate, CPU, memory, and instance count
- Neon query latency, active connections, and CPU
- Cloudflare 5xx/524 responses
- App logs for `statement timeout`, failed DB queries, and unhandled errors

## Safety Notes

Do not run spike or stress tests against production during normal shopping
hours. Start low, increase gradually, and stop the test if Cloud Run, Neon, or
Cloudflare errors climb quickly.

The storefront flow profile visits checkout and checkout-adjacent APIs, but it
does not submit the checkout form and does not create orders.
