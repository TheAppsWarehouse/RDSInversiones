import { getSupabaseClient } from '@/template';

export type RiskProfile = 'Conservative' | 'Moderate' | 'Aggressive';

// ─── Scoring helpers ───────────────────────────────────────────────────────────

// Investment Horizon questions: 1, 3, 5, 7 (0-indexed: 0, 2, 4, 6)
// a=0, b=1, c=2
const HORIZON_SCORE: Record<string, number> = { a: 0, b: 1, c: 2 };

// Risk Tolerance questions: 2, 4, 6 (0-indexed: 1, 3, 5) → a=2, b=5, c=7
const TOLERANCE_SCORE_Q2_4_6: Record<string, number> = { a: 2, b: 5, c: 7 };

// Risk Tolerance question: 8 (0-indexed: 7) → a=1, b=2, c=3
const TOLERANCE_SCORE_Q8: Record<string, number> = { a: 1, b: 2, c: 3 };

/**
 * answers: array of 8 strings, each 'a' | 'b' | 'c'
 * Index mapping: 0=Q1, 1=Q2, 2=Q3, 3=Q4, 4=Q5, 5=Q6, 6=Q7, 7=Q8
 */
export function calculateRiskProfile(answers: string[]): {
  horizonScore: number;
  toleranceScore: number;
  profile: RiskProfile;
} {
  // Investment Horizon: Q1(0), Q3(2), Q5(4), Q7(6)
  const horizonScore =
    (HORIZON_SCORE[answers[0]] ?? 0) +
    (HORIZON_SCORE[answers[2]] ?? 0) +
    (HORIZON_SCORE[answers[4]] ?? 0) +
    (HORIZON_SCORE[answers[6]] ?? 0);

  // Risk Tolerance: Q2(1), Q4(3), Q6(5) + Q8(7)
  const toleranceScore =
    (TOLERANCE_SCORE_Q2_4_6[answers[1]] ?? 0) +
    (TOLERANCE_SCORE_Q2_4_6[answers[3]] ?? 0) +
    (TOLERANCE_SCORE_Q2_4_6[answers[5]] ?? 0) +
    (TOLERANCE_SCORE_Q8[answers[7]] ?? 0);

  const profile = assignProfile(horizonScore, toleranceScore);
  return { horizonScore, toleranceScore, profile };
}

function assignProfile(h: number, t: number): RiskProfile {
  // ── Aggressive ──
  if (h === 8 && t >= 18 && t <= 19) return 'Aggressive';
  if (h >= 7 && h <= 8 && t >= 20 && t <= 21) return 'Aggressive';
  if (h >= 4 && h <= 8 && t >= 22 && t <= 23) return 'Aggressive';
  if (h >= 2 && h <= 8 && t >= 24 && t <= 25) return 'Aggressive';

  // ── Moderate ──
  if (h === 8 && t >= 10 && t <= 11) return 'Moderate';
  if (h >= 7 && h <= 8 && t >= 12 && t <= 13) return 'Moderate';
  if (h >= 6 && h <= 8 && t >= 14 && t <= 15) return 'Moderate';
  if (h >= 3 && h <= 8 && t >= 16 && t <= 17) return 'Moderate';
  if (h >= 2 && h <= 7 && t >= 18 && t <= 19) return 'Moderate';
  if (h >= 1 && h <= 6 && t >= 20 && t <= 21) return 'Moderate';
  if (h >= 0 && h <= 3 && t >= 22 && t <= 23) return 'Moderate';
  if (h >= 0 && h <= 1 && t >= 24 && t <= 25) return 'Moderate';

  // ── Conservative (default / catch-all for the matrix) ──
  return 'Conservative';
}

// ─── DB helpers ────────────────────────────────────────────────────────────────

export async function saveRiskProfile(
  userId: string,
  profile: RiskProfile
): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('user_profiles')
    .update({ risk_profile: profile })
    .eq('id', userId);

  return { error: error?.message ?? null };
}

export async function getRiskProfile(
  userId: string
): Promise<{ data: RiskProfile | null; error: string | null }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('risk_profile')
    .eq('id', userId)
    .single();

  return {
    data: (data?.risk_profile as RiskProfile) ?? null,
    error: error?.message ?? null,
  };
}
