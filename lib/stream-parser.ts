// lib/stream-parser.ts
export interface ParsedMessage {
  textContent: string;      // Text without code blocks
  codeContent: string;      // Raw TOON JSON block with fences
  hasCode: boolean;
  isComplete: boolean;
}

export function parseMessageContent(content: string): ParsedMessage {
  // Match complete TOON code block
  const codeMatch = content.match(/```json\s*\n([\s\S]*?)\n```/);
  
  if (codeMatch) {
    // Extract text before and after code block
    const textContent = content
      .replace(/```json\s*\n[\s\S]*?\n```/, '')
      .trim();
    
    return {
      textContent,
      codeContent: codeMatch[0], // Full block with fences
      hasCode: true,
      isComplete: true
    };
  }
  
  // Check if code block is still streaming
  const incompleteMatch = content.match(/```json/);
  
  return {
    textContent: content,
    codeContent: '',
    hasCode: incompleteMatch !== null,
    isComplete: false
  };
}