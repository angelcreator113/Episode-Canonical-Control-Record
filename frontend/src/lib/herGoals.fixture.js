// Evoni's Goals tab on 2026-10-25 ("This is very confusing I don't know what I
// am to do"): 21 active goals and one completed, coins 294, influence 2.
// Shared by the goal-ladder tests.
let t = 0;
const STATE = { coins: 294, reputation: 0, brand_trust: 0, influence: 2, followers: 0, stress: 2, consistency_streak: 1, portfolio_strength: 0 };
const G = (id, title, type, metric, target, extra = {}) => ({
  id, title, type, status: 'active', target_metric: metric, target_value: target, current_value: STATE[metric] ?? 0, starting_value: 0,
  priority: type === 'primary' ? 1 : type === 'passive' ? 4 : 2, icon: '🎯', color: '', episode_range: null, unlocks_on_complete: [],
  created_at: new Date(Date.UTC(2026, 9, 1, 0, t++)).toISOString(), ...extra,
});
export const HER_GOALS = [
  G('g-legacy', 'Legacy', 'primary', 'reputation', 10),
  G('g-maison', 'The Maison Belle Contract', 'primary', 'brand_trust', 8),
  G('g-luxury', 'Luxury Access', 'primary', 'reputation', 7),
  G('g-brandgirl', 'Brand Girl Era', 'secondary', 'brand_trust', 4),
  G('g-firstimp', 'First Impressions', 'secondary', 'reputation', 3),
  G('g-giveback', 'Give Back', 'secondary', 'influence', 10),
  G('g-pressure', 'The Pressure of Influence', 'secondary', 'stress', 4),
  G('g-trust', 'Trust the Process', 'secondary', 'brand_trust', 6),
  G('g-money', 'The Money Talk', 'secondary', 'coins', 2000),
  G('g-portfolio', 'Build the Portfolio', 'secondary', 'portfolio_strength', 5),
  G('g-collection', 'The Perfect Collection', 'primary', 'coins', 25000),
  G('g-indep', 'Financial Independence', 'secondary', 'coins', 10000),
  G('g-25k', '25K Strong', 'primary', 'followers', 25000),
  G('g-growing', 'Growing Influence', 'secondary', 'influence', 4),
  G('g-5k', 'First 5K', 'secondary', 'followers', 5000),
  G('g-global', 'Global Reach', 'secondary', 'influence', 8),
  G('g-closet', 'Closet Upgrade', 'secondary', 'coins', 5000),
  G('g-flop', 'Survive the Flop', 'secondary', 'reputation', 3, { description: 'Fail at an event and recover.' }),
  G('g-starter', 'Starter Fund', 'secondary', 'coins', 500),
  G('g-consistent', 'Stay Consistent', 'passive', 'consistency_streak', 7),
  G('g-stress', 'Manage Stress', 'passive', 'stress', 3),
  { ...G('g-lights', 'Keep the Lights On', 'secondary', 'coins', 200), status: 'completed', completed_at: '2026-10-12T12:00:00Z' },
];
