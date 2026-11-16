# Perplexity bridge
- **seed:** Perplexity does web research with cited answers, through its own API; Ronin adds no command.
- **when:** integration:perplexity
- **depth:** full
- **order:** 27

Use Perplexity for a question the web answers, when you need its sources.

- Its API: `POST https://api.perplexity.ai/chat/completions`, `Authorization: Bearer` the
  secret `perplexity-api-key`, a `model` (`sonar`, or `sonar-pro` for a harder question) and
  your question as a user message. The answer carries its citations.
- Return the sources with the answer; say when an answer rests on one source.
- Each call costs the owner money: ask one good question rather than many small ones.
