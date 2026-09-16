# Reach Ronin from your other devices

Ronin is reached at `https://<machine>.<tailnet>.ts.net:4810`. Access is controlled by
Tailscale: its access rules determine which users and devices can reach Ronin and use
the installed account's shells. Ronin does not manage the owner's Tailscale account.

Use the full machine name reported by Tailscale, not a guessed name or numeric address.
HTTPS setup is part of installation. The installer prints the address after checking it;
there is no separate command to turn that address into the final browser destination.

## Set up access

1. Install Tailscale on the Ronin machine using the [official installation guide](https://tailscale.com/kb/1347/installation).
   The owner signs it into the intended tailnet. If it is already installed, inspect
   `tailscale status` before changing anything.
2. Follow [Install Ronin](../getting-started/install.md). Setup explains any needed
   administrator changes and establishes private HTTPS on port `4810`. If it cannot
   finish, resolve the reported condition before treating installation as complete.
3. Install Tailscale on the browser device and join the intended tailnet. Check that
   Tailscale is connected on both devices and that the access rules permit the connection.
   The owner handles sign-in and any device authorization.
4. Open the verified address from that device, then bookmark it. Continue through
   [Get started](../getting-started/get-started.md) to one responding Agent.

Keep the distinction clear: installing the Tailscale app, signing in, and connecting it
are separate states. A browser device on a different tailnet will not gain access merely
because both devices have the app. On phones, approve the operating system's VPN setup
prompt when connecting Tailscale.

## When it does not work

Measure the current state instead of guessing from a previous successful install:

```bash
tailscale status
tailscale serve status
bin/ronin-doctor
```

- **Device unavailable:** check whether the Ronin machine is awake, Tailscale is connected
  on both devices, and both are on the intended tailnet.
- **Access refused:** inspect the tailnet's access rules for the browser device and Ronin
  machine. Being listed in a tailnet does not by itself establish permitted access.
- **Name does not resolve:** confirm the exact machine DNS name and the tailnet's DNS
  configuration. Do not replace the HTTPS address with a numeric address.
- **HTTPS is missing or unhealthy:** use the installer's or doctor's finding to repair
  the mapping or certificate setup. The final address remains HTTPS on port `4810`.
  Do not substitute another protocol or port to declare success.
- **Ronin is not running:** check the service on the machine. A working Tailscale
  connection alone does not prove that the application is available.
- **Tailscale command unavailable:** distinguish a missing command from an app that is
  installed but disconnected. Follow the platform's official Tailscale instructions;
  do not repeatedly reinstall Ronin to fix a missing Tailscale CLI.

Say whether the machine cannot be reached or the application is not answering. Those
failures have different remedies. After repair, check the HTTPS address from the owner's
browser device as well as from the machine.

## Network boundary

Do not forward Ronin's port through the router or publish it through Tailscale Funnel.
Private HTTPS uses Tailscale Serve. The internal application listener and proxy target
are implementation details, not alternative addresses to hand to the owner.

Provider-console and SSH access remain useful for administering or repairing a remote
machine. They do not replace the verified browser destination. Keep credentials with the
owner; do not put sign-in tokens or authentication material in notes or transcripts.
