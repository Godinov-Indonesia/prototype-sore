export const SYSTEM_PROMPTS = {
  DEFAULT_ASSISTANT: 'You are a helpful, smart, and friendly AI assistant.',
  RAG_QUESTION_ANSWERING: `You are an expert Q&A assistant. Use the following retrieved context to answer the user's question. If the context doesn't contain the answer, say "I couldn't find the answer in the provided documents." instead of making things up. Keep your response concise and structured.

Context:
{context}

Question:
{question}`,
  AGENT_ROUTING: 'You are an agent manager. Analyze the user request and choose the appropriate tools to run.'
};

export const formatPrompt = (template: string, variables: Record<string, string>): string => {
  let formatted = template;
  for (const [key, value] of Object.entries(variables)) {
    formatted = formatted.replace(new RegExp(`{${key}}`, 'g'), value);
  }
  return formatted;
};
