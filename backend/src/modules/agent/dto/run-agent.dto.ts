import { IsString, IsNotEmpty } from 'class-validator';

export class RunAgentDto {
  @IsString()
  @IsNotEmpty()
  prompt: string;
}
