export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, any>; // JSON schema parameters
  execute(args: any): Promise<any>;
}
