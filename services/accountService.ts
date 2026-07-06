import { getSupabaseClient } from '@/template';

export type AccountType = 'Admin' | 'Affiliate' | 'Free' | 'Dev';

export const accountService = {
  /**
   * Get account type for a given email.
   * Works for both anon (pre-login check) and authenticated users.
   */
  async getAccountType(email: string): Promise<{ data: AccountType | null; error: string | null }> {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('allowed_emails')
        .select('account_type')
        .eq('email', email.toLowerCase().trim())
        .maybeSingle();

      if (error) {
        return { data: null, error: error.message };
      }

      if (!data) {
        return { data: 'Free', error: null };
      }

      return { data: data.account_type as AccountType, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  },

  /**
   * Register a new self-signed-up Free account in allowed_emails with new_affiliates = true.
   * Called only during the OTP verification flow for brand-new registrations.
   */
  async recordFreeRegistration(email: string): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      const normalizedEmail = email.toLowerCase().trim();
      // Only insert if the email is not already in allowed_emails
      const { data: existing } = await supabase
        .from('allowed_emails')
        .select('id')
        .eq('email', normalizedEmail)
        .maybeSingle();
      if (!existing) {
        await supabase
          .from('allowed_emails')
          .insert({ email: normalizedEmail, account_type: 'Free', new_affiliates: true });
      }
    } catch {
      // Silent fail
    }
  },

  /**
   * Record first-time app access for a user.
   * Sets new_affiliates = true if account is Free (not in allowed_emails),
   * Sets new_affiliates = false if account is already Affiliate/Admin/Dev.
   * Only sets the value if new_affiliates is currently null (first access).
   */
  async recordFirstAccess(email: string): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      const normalizedEmail = email.toLowerCase().trim();

      const { data: existing } = await supabase
        .from('allowed_emails')
        .select('account_type, new_affiliates')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (existing) {
        // Email is in allowed_emails (Affiliate/Admin/Dev)
        // Only set new_affiliates if it's null (first access)
        if (existing.new_affiliates === null) {
          await supabase
            .from('allowed_emails')
            .update({ new_affiliates: false })
            .eq('email', normalizedEmail);
        }
      } else {
        // Free account — insert record with new_affiliates = true
        // Use upsert in case of race conditions
        await supabase
          .from('allowed_emails')
          .upsert(
            { email: normalizedEmail, account_type: 'Free', new_affiliates: true },
            { onConflict: 'email', ignoreDuplicates: false }
          );
      }
    } catch {
      // Silent fail — this is a non-critical background operation
    }
  },

  /**
   * Check if an email requires 2FA OTP on login (Admin or Dev accounts).
   */
  async requiresOtpLogin(email: string): Promise<boolean> {
    const { data } = await accountService.getAccountType(email);
    return data === 'Admin' || data === 'Dev';
  },

  // ─── Account Management ───────────────────────────────────────────────────────

  /**
   * Get all managed accounts (Affiliate + Admin) from allowed_emails.
   */
  async getAllManagedAccounts(): Promise<{ data: Array<{ id: string; email: string; account_type: AccountType; created_at: string; new_affiliates: boolean | null }> | null; error: string | null }> {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('allowed_emails')
        .select('id, email, account_type, created_at, new_affiliates')
        .order('email', { ascending: true });

      if (error) return { data: null, error: error.message };
      return { data: data as any, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  },

  /**
   * Update the new_affiliates flag for a given email. Dev-only operation.
   */
  async updateNewAffiliates(email: string, value: boolean | null): Promise<{ error: string | null }> {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('allowed_emails')
        .update({ new_affiliates: value })
        .eq('email', email.toLowerCase().trim());
      return { error: error ? error.message : null };
    } catch (err: any) {
      return { error: err.message };
    }
  },

  /**
   * Create or update a single account in allowed_emails.
   * All account types (including 'Free') are persisted in the table.
   */
  async upsertAccount(email: string, accountType: AccountType): Promise<{ error: string | null }> {
    try {
      const supabase = getSupabaseClient();
      const normalizedEmail = email.toLowerCase().trim();

      // Upsert: insert if not exists, update account_type if exists
      const { error } = await supabase
        .from('allowed_emails')
        .upsert(
          { email: normalizedEmail, account_type: accountType },
          { onConflict: 'email', ignoreDuplicates: false }
        );

      return { error: error ? error.message : null };
    } catch (err: any) {
      return { error: err.message };
    }
  },

  /**
   * Permanently delete an account from allowed_emails.
   * Note: this removes the row entirely. Use upsertAccount with 'Free' to keep the row.
   */

  async deleteAccount(email: string): Promise<{ error: string | null }> {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('allowed_emails')
        .delete()
        .eq('email', email.toLowerCase().trim());
      return { error: error ? error.message : null };
    } catch (err: any) {
      return { error: err.message };
    }
  },

  /**
   * Batch update new_affiliates flags. Dev-only.
   */
  async batchUpdateNewAffiliates(
    items: Array<{ email: string; new_affiliates: boolean | null }>
  ): Promise<{ successCount: number; failedCount: number; errors: string[] }> {
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    for (const item of items) {
      const { error } = await accountService.updateNewAffiliates(item.email, item.new_affiliates);
      if (error) {
        failedCount++;
        errors.push(`${item.email}: ${error}`);
      } else {
        successCount++;
      }
    }
    return { successCount, failedCount, errors };
  },

  async batchUpsertAccounts(
    accounts: Array<{ email: string; account_type: AccountType }>
  ): Promise<{ successCount: number; failedCount: number; errors: string[] }> {
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const account of accounts) {
      const { error } = await accountService.upsertAccount(account.email, account.account_type);
      if (error) {
        failedCount++;
        errors.push(`${account.email}: ${error}`);
      } else {
        successCount++;
      }
    }

    return { successCount, failedCount, errors };
  },
};
