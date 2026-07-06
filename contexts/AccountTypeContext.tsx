import React, { createContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { accountService, AccountType } from '@/services/accountService';

interface AccountTypeContextType {
  accountType: AccountType;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export const AccountTypeContext = createContext<AccountTypeContextType | undefined>(undefined);

const POLL_INTERVAL_MS = 30000; // 30 seconds

interface AccountTypeProviderProps {
  children: ReactNode;
  userEmail: string | null;
}

export function AccountTypeProvider({ children, userEmail }: AccountTypeProviderProps) {
  const [accountType, setAccountType] = useState<AccountType>('Free');
  const [isLoading, setIsLoading] = useState(false);
  const firstAccessRecorded = useRef(false);

  const fetchAccountType = useCallback(async () => {
    if (!userEmail) {
      setAccountType('Free');
      return;
    }

    setIsLoading(true);
    const { data } = await accountService.getAccountType(userEmail);
    if (data) {
      setAccountType(data);

      // Record first access only once per session
      if (!firstAccessRecorded.current) {
        firstAccessRecorded.current = true;
        accountService.recordFirstAccess(userEmail);
      }
    }
    setIsLoading(false);
  }, [userEmail]);

  useEffect(() => {
    fetchAccountType();
  }, [fetchAccountType]);

  useEffect(() => {
    if (!userEmail) return;
    const interval = setInterval(() => {
      fetchAccountType();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [userEmail, fetchAccountType]);

  const refresh = useCallback(async () => {
    await fetchAccountType();
  }, [fetchAccountType]);

  return (
    <AccountTypeContext.Provider value={{ accountType, isLoading, refresh }}>
      {children}
    </AccountTypeContext.Provider>
  );
}
