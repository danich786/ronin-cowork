/* Painter-only reading of the server-owned Setup progress resource. */
import { IRASSHAI, SETUP_SCENES } from './setup-journey.js';
import { HOSTED } from './hosted.js';
import { request } from './request.js';

export const SETUP_STEP_IDS = Object.freeze(['provider', 'register', 'workspace', 'installations', 'password']);

export function setupSteps(payload) {
  const source = Array.isArray(payload?.steps) ? payload.steps : [];
  const byId = new Map(source.map((step) => [step?.id, step]));
  return SETUP_STEP_IDS.map((id, index) => ({
    id, number: index + 1,
    label: SETUP_SCENES.find((scene) => scene.id === id)?.label || id,
    answered: byId.get(id)?.answered === true,
    answer: byId.get(id)?.answer === 'acted' || byId.get(id)?.answer === 'not_now' ? byId.get(id).answer : '',
  }));
}

export const firstUnansweredSetupStep = (payload) => setupSteps(payload).find((step) => !step.answered)?.id || '';

/**
 * Whether Setup is done, from Setup's own record (KAN-720): a hosted office's when the
 * Helpful Assistant's onboarding epic is Done (setup-journey.js onboardingDone); elsewhere when
 * every step is answered. A read that fails counts as done, so the bare address stays Home.
 */
export async function setupFinished() {
  if (HOSTED) {
    const result = await request(`/api/work-items?holder=${IRASSHAI}&kind=epic&status=done`, { cache: 'no-store' });
    return !result.ok || (result.data.items || []).length > 0;
  }
  const result = await request('/api/setup/progress', { cache: 'no-store' });
  return !result.ok || setupSteps(result.data).every((step) => step.answered);
}
