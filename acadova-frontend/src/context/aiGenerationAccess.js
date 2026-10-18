import { createContext, useContext } from 'react';
export const AiGenerationContext = createContext(null);
export const useAiGeneration = () => useContext(AiGenerationContext);
