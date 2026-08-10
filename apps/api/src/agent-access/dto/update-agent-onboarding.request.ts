import { IsIn } from 'class-validator';

export const AGENT_ONBOARDING_ACTIONS = [
  'START',
  'STOREFRONT_CONFIGURED',
  'PRICES_CONFIGURED',
  'PRODUCTS_REVIEWED',
  'STOREFRONT_SHARED',
  'COMPLETE',
  'DISMISS',
] as const;

export type AgentOnboardingAction = (typeof AGENT_ONBOARDING_ACTIONS)[number];

export class UpdateAgentOnboardingRequest {
  @IsIn(AGENT_ONBOARDING_ACTIONS)
  action!: AgentOnboardingAction;
}
