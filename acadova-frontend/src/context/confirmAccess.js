import { createContext, useContext } from 'react';

export const ConfirmContext = createContext(null);
export const useConfirm = () => useContext(ConfirmContext);
