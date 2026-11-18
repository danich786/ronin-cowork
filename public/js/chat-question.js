/* part of the ronin-cowork client — see js/README.md */
/**
 * THE QUESTION IN CHAT (KAN-657, KAN-658) — what an Agent's CLI is stopped at, at the end of its
 * conversation, answered there (owner, 2026-11-18: "Ideally, we never have to go to terminal or
 * even know it's there"). The card's `question` (src/asking.ts) is drawn as ERABI questions: a
 * choice per question the CLI asked, Approve or Keep planning under a plan, Yes or No under a
 * permission with the exact command. One press answers a single choice; several questions, or
 * checkboxes, go with Send. Ronin types the answer into the terminal and the tile stays on Chat.
 * Free text (the CLI's own "type something", an MCP form) keeps Answer in Terminal.
 */
import { t } from './lexicon.js';
import { ask } from './ask.js';
import { renderMarkdownDocument } from './markdown-reader.js';
import { WorkspacePrimitives } from './workspace-primitives.js';

const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = String(text);
  return node;
};

/** A question Chat can answer by a press; anything else is Answer in Terminal's. */
export const answerable = (question) => ['choice', 'plan', 'permission'].includes(question?.kind);

/**
 * @param question  the card's question
 * @param send      (answer) → Promise<{ ok, message }>: { choices: [n | [n…]] } or { yes }
 * @param terminal  the way to the terminal, for free text; null where there is none
 */
export function buildQuestion(question, { send, terminal = null }) {
  const { createAction, createActionBar } = WorkspacePrimitives;
  const root = el('div', 'chat-question');
  const notice = el('p', 'chat-question-notice');
  let busy = false;
  const answer = async (value) => {
    if (busy) return;
    busy = true;
    root.dataset.state = 'sending';
    notice.textContent = t('question.sending', 'Answering…');
    const result = await send(value);
    busy = false;
    root.dataset.state = result.ok ? 'sent' : '';
    notice.textContent = result.ok ? '' : result.message;
  };
  const yesNo = (yes, no) => ask([{ fields: [{ key: 'yes', label: t('question.answer', 'Answer'), options: [{ v: 'yes', l: yes }, { v: 'no', l: no }] }] }], {
    exposed: true, density: 'tight', onChange: (now) => { if (now.yes) void answer({ yes: now.yes === 'yes' }); },
  }).el;

  if (question.kind === 'plan') {
    root.append(el('p', 'chat-question-title', t('question.plan', 'Approve this plan?')),
      renderMarkdownDocument(question.plan),
      yesNo(t('question.approve', 'Approve'), t('question.keep_planning', 'Keep planning')));
  } else if (question.kind === 'permission') {
    root.append(el('p', 'chat-question-title', t('question.permission', 'Allow {tool}?', { tool: question.tool })));
    if (question.reason && question.reason !== question.detail) root.append(el('p', 'chat-question-reason', question.reason));
    if (question.detail) root.append(renderMarkdownDocument(`\`\`\`\n${question.detail}\n\`\`\``));
    root.append(yesNo(t('question.yes', 'Yes'), t('question.no', 'No')));
  } else {
    const questions = question.questions || [];
    // One question of one answer goes on the press; anything more waits for Send.
    const onePress = questions.length === 1 && !questions[0].many;
    const picks = questions.map((q, i) => {
      const fieldKey = `q${i}`;
      const one = ask([{ fields: [{
        key: fieldKey, label: q.header || t('question.answer', 'Answer'), many: q.many,
        options: q.options.map((o, n) => ({ v: String(n), l: o.label, ...(o.description ? { sub: o.description } : {}) })),
      }] }], {
        exposed: true, density: 'tight',
        onChange: (now) => { if (onePress && now[fieldKey] !== '') void answer({ choices: [Number(now[fieldKey])] }); },
      });
      root.append(el('p', 'chat-question-title', q.question), one.el);
      return { q, one, fieldKey };
    });
    const actions = [];
    if (!onePress) {
      actions.push(createAction({ label: t('question.send', 'Send'), kind: 'primary', size: 'compact', action: () => {
        const choices = picks.map(({ q, one, fieldKey }) => {
          const v = one.value()[fieldKey];
          return q.many ? v.map(Number) : v === '' ? null : Number(v);
        });
        if (choices.some((c) => c === null || (Array.isArray(c) && !c.length))) {
          notice.textContent = t('question.unanswered', 'Answer each question first.');
          return;
        }
        void answer({ choices });
      } }));
    }
    if (terminal) actions.push(createAction({ label: t('transcript.answer_in_terminal', 'Answer in Terminal'), size: 'compact', action: terminal }));
    if (actions.length) root.append(createActionBar({ actions }).el);
  }
  root.append(notice);
  return root;
}
