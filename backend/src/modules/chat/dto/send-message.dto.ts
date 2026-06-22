import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['user', 'system', 'assistant'])
  role: 'user' | 'system' | 'assistant';

  @IsString()
  @IsNotEmpty()
  content: string;
}
