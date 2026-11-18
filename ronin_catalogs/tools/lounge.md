# lounge
- **seed:** the person's Business Lounge record from HQ, now: subscription, balance, this office's rental, office limit, default models
- **when:** hosted
- **depth:** seed
- **serves:**
- **order:** 72

## Usage

`lounge` prints the person's lounge record as HQ holds it now: the account and its subscription;
the balance, spent this month and how long it lasts; this office's kind, rent, spend, office limit
and whether house models are open; its tier and the model behind each tier; its people and the
account's other offices; About you. `lounge --json` prints HQ's answer as it came.

Nothing runs on its own: an Agent runs `lounge`, and each run asks HQ once. Nothing is kept in the
office. It is the office's record, whoever asks. Agents only read it: account changes are the
person's, in the Business Lounge (https://hq.roninhosted.com/). Outside a hosted office it says
there is no lounge record; HQ unreachable, it says so and shows no numbers. `lounge --help`.
