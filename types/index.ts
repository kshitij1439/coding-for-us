export interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
  }
  
  export interface FileNode {
    name: string
    path: string
    type: 'file' | 'folder'
    content?: string
    children?: FileNode[]
  }
  
  export interface ProjectState {
    messages: Message[]
    files: FileNode[]  // Flat array for WebContainer
    activeFile: string | null
    isGenerating: boolean
    previewUrl: string | null
  }