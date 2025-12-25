import { create } from 'zustand'
import { Message, FileNode } from '@/types/index'

interface ProjectStore {
  messages: Message[]
  files: FileNode[]
  activeFile: string | null
  isGenerating: boolean

  addMessage: (message: Message) => void
  setFiles: (files: FileNode[]) => void
  updateFile: (path: string, content: string) => void
  setActiveFile: (path: string | null) => void
  setGenerating: (isGenerating: boolean) => void
  reset: () => void
}

export const useProjectStore = create<ProjectStore>((set) => ({
  messages: [],
  files: [],
  activeFile: null,
  isGenerating: false,

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  setFiles: (files) => set({ files }),

  updateFile: (path, content) =>
    set((state) => ({
      files: state.files.map((f) =>
        f.path === path ? { ...f, content } : f
      ),
    })),

  setActiveFile: (path) => set({ activeFile: path }),

  setGenerating: (isGenerating) => set({ isGenerating }),

  reset: () => set({
    messages: [],
    files: [],
    activeFile: null,
    isGenerating: false,
  }),
}))