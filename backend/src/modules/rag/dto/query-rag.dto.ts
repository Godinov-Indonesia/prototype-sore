import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';

export class QueryRagDto {
  @IsString()
  @IsNotEmpty()
  query: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  topK?: number;
}
