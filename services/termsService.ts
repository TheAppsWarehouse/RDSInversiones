/**
 * termsService.ts
 *
 * Terms & Conditions acceptance tracking with full DB-backed audit trail.
 *
 * Tables used:
 *   tc_versions    — one row per published T&C version (version = app version)
 *   tc_acceptances — immutable audit log of every user acceptance event
 *
 * The app version and T&C URL are sourced from app.json at build time via
 * the APP_VERSION / TC_URL constants below.  When the app is released with a
 * new version, insert a new row in tc_versions (or call ensureVersionExists)
 * and set is_active = true.
 */

import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { getSupabaseClient } from '@/template';

// ─── Build-time constants (keep in sync with app.json) ───────────────────────
export const APP_VERSION = '1.0.1';
export const TC_URL =
  'https://drive.google.com/file/d/15AxAykjO9dCgbqdI-RCQT_Oydrer5LfC/view?usp=drive_link';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TcVersion {
  id: string;
  version: string;
  url: string;
  published_at: string;
  is_active: boolean;
}

export interface TcAcceptance {
  id: string;
  user_id: string;
  version_id: string;
  accepted_at: string;
  app_version: string;
  device_info: Record<string, any> | null;
}

// ─── Version helpers ──────────────────────────────────────────────────────────

/**
 * Fetch the currently active T&C version from the database.
 * Returns null if no active version exists (unexpected — should always exist).
 */
export async function getActiveTermsVersion(): Promise<TcVersion | null> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('tc_versions')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('termsService.getActiveTermsVersion error:', error.message);
      return null;
    }
    return data as TcVersion | null;
  } catch (err) {
    console.error('termsService.getActiveTermsVersion exception:', err);
    return null;
  }
}

/**
 * Ensure the current app version is registered as an active tc_version row.
 * Called once during app startup (e.g., from LanguageContext or login flow).
 * Safe to call multiple times — uses upsert logic.
 */
export async function ensureActiveVersionExists(): Promise<TcVersion | null> {
  try {
    const supabase = getSupabaseClient();

    // Check if this version already exists
    const { data: existing, error: selectError } = await supabase
      .from('tc_versions')
      .select('*')
      .eq('version', APP_VERSION)
      .maybeSingle();

    if (selectError) {
      console.error('termsService.ensureActiveVersionExists select error:', selectError.message);
      return null;
    }

    if (existing) {
      // Already exists — make sure it's active (in case a rollback occurred)
      if (!existing.is_active) {
        await supabase
          .from('tc_versions')
          .update({ is_active: true })
          .eq('id', existing.id);
      }
      return existing as TcVersion;
    }

    // New version — deactivate all others first, then insert
    await supabase
      .from('tc_versions')
      .update({ is_active: false })
      .neq('version', APP_VERSION);

    const { data: inserted, error: insertError } = await supabase
      .from('tc_versions')
      .insert({ version: APP_VERSION, url: TC_URL, is_active: true })
      .select()
      .single();

    if (insertError) {
      console.error('termsService.ensureActiveVersionExists insert error:', insertError.message);
      return null;
    }
    return inserted as TcVersion;
  } catch (err) {
    console.error('termsService.ensureActiveVersionExists exception:', err);
    return null;
  }
}

// ─── Acceptance helpers ───────────────────────────────────────────────────────

/**
 * Check whether the given user has accepted the currently active T&C version.
 * Returns the acceptance record if found, null otherwise.
 */
export async function getUserAcceptanceForActiveVersion(
  userId: string
): Promise<TcAcceptance | null> {
  try {
    const supabase = getSupabaseClient();

    // Get active version id first
    const activeVersion = await getActiveTermsVersion();
    if (!activeVersion) return null;

    const { data, error } = await supabase
      .from('tc_acceptances')
      .select('*')
      .eq('user_id', userId)
      .eq('version_id', activeVersion.id)
      .maybeSingle();

    if (error) {
      console.error('termsService.getUserAcceptanceForActiveVersion error:', error.message);
      return null;
    }
    return data as TcAcceptance | null;
  } catch (err) {
    console.error('termsService.getUserAcceptanceForActiveVersion exception:', err);
    return null;
  }
}

/**
 * Record that a user has accepted the current active T&C version.
 * Captures device metadata for full audit traceability.
 * Returns the created acceptance record or null on failure.
 */
export async function recordTermsAcceptance(
  userId: string
): Promise<TcAcceptance | null> {
  try {
    const supabase = getSupabaseClient();

    // Resolve active version
    const activeVersion = await getActiveTermsVersion();
    if (!activeVersion) {
      console.error('termsService.recordTermsAcceptance: no active T&C version found');
      return null;
    }

    // Build device info payload
    const deviceInfo: Record<string, any> = {
      platform: Platform.OS,
      app_version: APP_VERSION,
    };
    try {
      deviceInfo.device_name = Device.deviceName ?? 'unknown';
      deviceInfo.device_model = Device.modelName ?? 'unknown';
      deviceInfo.os_version = Device.osVersion ?? 'unknown';
      deviceInfo.is_device = Device.isDevice;
    } catch {
      // expo-device may not be available in all environments
    }

    const { data, error } = await supabase
      .from('tc_acceptances')
      .insert({
        user_id: userId,
        version_id: activeVersion.id,
        app_version: APP_VERSION,
        device_info: deviceInfo,
      })
      .select()
      .single();

    if (error) {
      // Unique constraint violation means already accepted — not an error
      if (error.code === '23505') {
        return await getUserAcceptanceForActiveVersion(userId);
      }
      console.error('termsService.recordTermsAcceptance error:', error.message);
      return null;
    }
    return data as TcAcceptance;
  } catch (err) {
    console.error('termsService.recordTermsAcceptance exception:', err);
    return null;
  }
}

/**
 * Fetch full acceptance history for a user (all versions ever accepted).
 * Useful for audit / admin views.
 */
export async function getUserAcceptanceHistory(userId: string): Promise<
  Array<TcAcceptance & { tc_versions: TcVersion }>
> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('tc_acceptances')
      .select('*, tc_versions(*)')
      .eq('user_id', userId)
      .order('accepted_at', { ascending: false });

    if (error) {
      console.error('termsService.getUserAcceptanceHistory error:', error.message);
      return [];
    }
    return (data ?? []) as Array<TcAcceptance & { tc_versions: TcVersion }>;
  } catch (err) {
    console.error('termsService.getUserAcceptanceHistory exception:', err);
    return [];
  }
}
