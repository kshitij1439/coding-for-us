"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import sdk from "@stackblitz/sdk";

interface StackBlitzContextType {
    vm: any;
    isLoading: boolean;
}

const StackBlitzContext = createContext<StackBlitzContextType>({
    vm: null,
    isLoading: true,
});

export function StackBlitzProvider({ children }: { children: React.ReactNode }) {
    const [vm, setVm] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // StackBlitz doesn't need pre-initialization like WebContainer
        setIsLoading(false);
    }, []);

    return (
        <StackBlitzContext.Provider value={{ vm, isLoading }}>
            {children}
        </StackBlitzContext.Provider>
    );
}

export function useStackBlitz() {
    return useContext(StackBlitzContext);
}