# gbrain memory integration

Ronin can connect Agents to gbrain for shared knowledge. It is a separate installation;
check its measured status before relying on an Agent to remember or retrieve information.

## Set it up

Open **gbrain** in Ronin Setup. The page separates:

- **Installed**: whether the local installation is present and what setup or repair it needs.
- **Available**: whether the installation is enabled.
- **Default for all Agents**: whether new Agents inherit it by default.
- **Accounts linked**: the integrations reported by the running service.

Follow the next action shown. Making the installation available and selecting it for an
Agent are separate choices. A change to launch defaults does not reconfigure a running
provider CLI.

## Understand connections and data

Inspect the local process, listening address, external provider, integrations, and public
access facts shown by the gbrain surface. Do not assume a local listening address means an
external account has been linked—or that a linked account has already supplied data.

Setup or repair may hand a request to an assistant. Review the account and access requested
before approving a connection. Keep credentials out of messages and documents.

Ask an Agent to inspect the installation's current data and backup paths before moving,
removing, or backing it up. Provider conversation history and shared memory are different
things; neither substitutes for a verified backup of the other.

Contributors: [Services installer](https://github.com/ronincowork/ronin-services/blob/dev/gbrain/README.md),
[install contract](https://github.com/ronincowork/ronin-services/blob/dev/install-contract.md),
and the [UI ownership index](../../public/js/README.md). The service owns its status and
installer; Cowork owns the browser surface. Local weights is currently parked, so source
presence does not establish that an embedding service is running.
