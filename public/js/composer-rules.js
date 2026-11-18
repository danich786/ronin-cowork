/* part of the ronin-cowork client — see js/README.md */
import { request } from './request.js';
/**
 * The composer's send and settlement rules.
 *
 * The box clears on the press: the text is handed to Ronin then, and the box never waits on
 * the answer or on the terminal (KAN-623: an answer that came late kept the text, and the
 * next press sent it twice). Only a failed send gives the text back, ahead of anything typed
 * since, with the reason. Nothing here retries.
 */

/**
 * @param {{ok: boolean, why?: string|null}} outcome  the host's answer to one message
 * @param {string} sent    the text the message carried
 * @param {string} boxNow  what the box holds when the answer arrives
 * @returns {{box: string|null, why: string|null}}  `box`: what the box holds now; null leaves it
 */
export function settleComposer(outcome, sent, boxNow) {
  if (outcome && outcome.ok) return { box: null, why: null };
  return { box: boxNow ? `${sent}\n${boxNow}` : sent, why: (outcome && outcome.why) || 'refused' };
}

/** Every complete message enters the same queue. Never append a terminal Enter here.
 *  `typed`: the person is at this Agent's keyboard, so it arrives with no From line. */
export async function sendComposerMessage(target, text) {
  const result = await request('/api/messages', { method: 'POST', json: { target, text, typed: true } });
  if (!result.ok) return { ok: false, why: result.message };
  // Once accepted, the queue owns the only copy.
  return { ok: result.data.ok === true, why: 'refused' };
}
