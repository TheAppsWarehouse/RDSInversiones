import { useContext } from 'react';
import { AccountTypeContext } from '@/contexts/AccountTypeContext';

export function useAccountType() {
  const context = useContext(AccountTypeContext);
  if (!context) {
    throw new Error('useAccountType must be used within AccountTypeProvider');
  }
  return context;
}
