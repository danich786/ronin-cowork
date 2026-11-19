# lounge
- **seed:** the person's Business Lounge record: subscription, balance, this office's rental, office limit, default models
- **when:** hosted
- **depth:** seed
- **serves:**
- **order:** 72

## Usage

`lounge` prints the person's lounge record, as of the time it carries: the account and its
subscription; the balance, spent this month and how long it lasts; this office's kind, rent,
spend, office limit and whether house models are open; its tier and the model behind each tier;
its people and the account's other offices; About you. `lounge --json` prints the record as it is.

The park keeps the record in the office (`lounge.json`), within 30 seconds of a change at HQ; an
Agent runs `lounge` to read it. It is the office's record, whoever asks. Agents only read it:
account changes are the person's, in the Business Lounge (https://hq.roninhosted.com/). Outside a
hosted office it says there is no lounge record; in a new office, that it hasn't arrived yet.
`lounge --help`.
