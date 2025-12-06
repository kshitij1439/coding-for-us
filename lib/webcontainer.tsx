"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { WebContainer } from '@webcontainer/api';

interface WebContainerContextType {
  webcontainer: WebContainer | null;
  isLoading: boolean;
  error: Error | null;
}

const WebContainerContext = createContext<WebContainerContextType>({
  webcontainer: null,
  isLoading: true,
  error: null,
});

export function WebContainerProvider({ children }: { children: React.ReactNode }) {
  const [webcontainer, setWebContainer] = useState<WebContainer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const bootWebContainer = async () => {
      try {
        // console.log(' Booting WebContainer...');
        const instance = await WebContainer.boot();
        
        if (mounted) {
          // console.log(' WebContainer booted successfully');
          setWebContainer(instance);
          setIsLoading(false);
        }
      } catch (err) {
        console.error(' Failed to boot WebContainer:', err);
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to boot WebContainer'));
          setIsLoading(false);
        }
      }
    };

    bootWebContainer();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <WebContainerContext.Provider value={{ webcontainer, isLoading, error }}>
      {children}
    </WebContainerContext.Provider>
  );
}

export function useWebContainer() {
  const context = useContext(WebContainerContext);
  if (context === undefined) {
    throw new Error('useWebContainer must be used within a WebContainerProvider');
  }
  return context;
}