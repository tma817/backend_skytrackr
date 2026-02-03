import { Controller, Post, Body, UsePipes, ValidationPipe, Delete, Param, Get } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { GetAIMessageDTO } from './model/get-ai-response.dto';
import { FlightPredictionDTO, BatchFlightPredictionDTO } from './model/flight-prediction.dto';

@Controller('gemini')
export class GeminiController {
  constructor(private readonly service: GeminiService) {}

  @Post('')
  @UsePipes(new ValidationPipe({ transform: true }))
  getResponse(@Body() data: GetAIMessageDTO) {
    return this.service.generateText(data);
  }

  @Post('flight-prediction')
  @UsePipes(new ValidationPipe({ transform: true }))
  async getFlightPrediction(@Body() data: FlightPredictionDTO) {
    return this.service.getFlightRecommendation(data);
  }

  @Post('flight-prediction/batch')
  @UsePipes(new ValidationPipe({ transform: true }))
  async batchFlightPrediction(@Body() data: BatchFlightPredictionDTO) {
    return this.service.batchFlightRecommendations(data.flights);
  }

  @Delete('session/:sessionId')
  deleteSession(@Param('sessionId') sessionId: string) {
    const deleted = this.service.clearSession(sessionId);
    return { success: deleted };
  }

  @Get('sessions')
  getSessions() {
    return { sessions: this.service.getActiveSessions() };
  }
}