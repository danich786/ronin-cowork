# Services activation construction

For contributors. [Ronin Services](../getting-started/services-activation.md) owns the
usage route. Cowork owns activation because a base installation must be able to obtain
Services before any optional part is loaded.

## Boundaries and ownership

| Owner | Responsibility |
|---|---|
| `src/activation/transport.ts` | Shared allowlisted HTTPS transport to Ronin HQ |
| `src/activation/egress.ts` | Request metadata and outcomes, without tokens, addresses, or bodies |
| `src/activation/state.ts` | Durable activation stage and public entitlement identity |
| `src/activation/secrets.ts` | Protected claim and entitlement credentials |
| `src/activation/flow.ts` | Request, confirmation polling, recovery, and install handoff |
| `src/routes/services-activation-api.ts` | Registration and activation browser routes |
| `public/js/services-setup-state.js` | Derive the Setup actions from measured registration, installation, and activation facts |
| `src/update-run.ts` | Shared updater launcher |
| `src/activation/tomodachi.ts` | Send Services packets through the existing HQ transport |

The remote wire contract belongs to Ronin HQ (Shiwake). Services part discovery and
registration belong to the [Services connector contract](https://github.com/ronincowork/ronin-services/blob/dev/connector-contract.md).
Do not create a second activation aggregate in Services or in machine-settings projections.

## Registration and runtime state

`/api/setup/registration` owns the current registration surface, with separate communication
and recovery routes. `/api/services/activation` exposes the activation state and connection
record; its poll route checks HQ. The retained activation routes share the same state.
The browser never receives either credential. Public entitlement IDs identify an entitlement;
they cannot authorize a request.

`GET /api/installed` separates parts on disk, loaded/parked/failed parts, selected Services
capabilities, and restart-needed state. `servicesSetupModel` renders Register, Install,
Switch on/off, and the conditional Restart action from those facts. A successful registration
is not proof of installation, and a saved switch is not proof of a loaded part.

The durable activation stages include requesting, awaiting email, verified, installing,
installed, expired, cancelled, address changed, and error, as well as not requested.
Persist transitions before reporting success. Store the entitlement credential before its
public identity, and retain the claim until that publication succeeds so recovery can
repeat confirmation safely. An incomplete entitlement response cannot establish success.

## Installation and recovery

The existing updater checks release integrity and the Cowork/Services connector version.
`POST /api/services/install` is a recovery entry into that updater; it is not a separate
installer. The hosted fetch uses the entitlement and release grant. The public feed and
local artifact paths remain distinct supported install paths.

Installation completion needs runtime evidence, not just a downloaded artifact or a token.
An install failure retains entitlement for retry. Restarting the operator does not restart
the separate tmux server. Credentials live in the resolved `services_secrets` user store
and remain server-side.

## Outbound measurements

Services produces aggregate packets; Cowork's HQ sender owns transport, authentication,
receipts, and retries. A packet remains pending until acknowledged; closed refusals are
retained separately rather than retried forever. The connection record covers this HQ
transport, not provider CLI traffic or all machine networking.

The current counting contract is documented in [Services Stats](https://github.com/ronincowork/ronin-services/blob/dev/docs/stats.md).
Collection cadence, active days, and submission cadence are distinct; a weekly schedule
must not be presented as proof of seven days of activity.

## Verification

`tests/services-activation.test.ts` checks the local flow with isolated dependencies.
`tests/integration/two-leg.test.ts` is the explicit cross-system diagnostic; it is not an
ordinary unit-test gate. Use the Services verification wrapper for part registration and
runtime placement. A passing test proves its fixture, not a deployment to the live operator.
