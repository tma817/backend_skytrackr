import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GetAIMessageDTO {
  @IsNotEmpty()
  @IsString()
  prompt: string;

  @IsString()
  @IsOptional()
  sessionId?: string;
}
