import { GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetAIMessageDTO } from './model/get-ai-response.dto';
import {
  FlightPredictionDTO,
  PredictionResponseDTO,
} from './model/flight-prediction.dto';
import { ChatSession } from '@google/generative-ai';
import { v4 } from 'uuid';

const GEMINI_MODEL = 'gemini-2.5-flash';

@Injectable()
export class GeminiService {
  private readonly googleAI: GoogleGenerativeAI;
  private readonly model: GenerativeModel;
  private chatSessions: { [sessionId: string]: ChatSession } = {};
  private readonly logger = new Logger(GeminiService.name);

  constructor(private readonly configService: ConfigService) {
    const geminiApiKey = configService.get('GEMINI_API_KEY');
    this.googleAI = new GoogleGenerativeAI(geminiApiKey);
    this.model = this.googleAI.getGenerativeModel({
      model: GEMINI_MODEL,
    });
  }

  private getChatSession(sessionId?: string) {
    let sessionIdToUse = sessionId ?? v4();

    let result = this.chatSessions[sessionIdToUse];
    if (!result) {
      result = this.model.startChat();
      this.chatSessions[sessionIdToUse] = result;
    }

    return { sessionId: sessionIdToUse, chat: result };
  }
  async generateText(data: GetAIMessageDTO) {
    try {
      const { sessionId, chat } = this.getChatSession(data.sessionId);

      const result = await chat.sendMessage(data.prompt);
      return {
        result: await result.response.text(),
        sessionId,
      };
    } catch (error) {
      this.logger.error('Error sending message to Gemini API >> ', error);
    }
  }

  /**
   * Get AI recommendation for a single flight
   */
  async getFlightRecommendation(
    flightData: FlightPredictionDTO,
  ): Promise<PredictionResponseDTO> {
    const daysUntilDeparture = this.calculateDaysUntilDeparture(
      flightData.departureDate,
    );

    const prompt = `
You are a flight price prediction expert. Based on the following data, recommend whether the user should "BUY_NOW" or "WAIT" for a better price.

Current Flight:
- Route: ${flightData.route}
- Current Price: $${flightData.currentPrice}
- Departure Date: ${flightData.departureDate}
- Days Until Departure: ${daysUntilDeparture}
${flightData.historicalPrices && flightData.historicalPrices.length > 0 ? `- Historical Prices (last ${flightData.historicalPrices.length} data points): $${flightData.historicalPrices.join(', $')}` : ''}

Consider:
1. Current price vs typical market price for this route
2. Time until departure (prices usually rise 2-3 weeks before departure)
3. Historical price trends if available
4. Day of week and seasonal factors
5. If departure is within 14 days, prices typically only go up

Rules:
- If less than 14 days until departure and price is reasonable → BUY_NOW
- If price is significantly below historical average → BUY_NOW
- If price is rising trend and departure is soon → BUY_NOW
- If departure is far out (30+ days) and price is high → WAIT
- If price is above historical average and time permits → WAIT

Respond ONLY with valid JSON.
Do not include markdown, explanations, or extra text.
{
  "recommendation": one of ["BUY_NOW", "WAIT"]
  "confidence": one of ["HIGH", "MEDIUM", "LOW"]
}
    `.trim();

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response.text();

      // Parse JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          recommendation:
            parsed.recommendation === 'BUY_NOW' ? 'BUY_NOW' : 'WAIT',
          confidence: parsed.confidence || 'MEDIUM',
        };
      }

      // Fallback: simple text parsing
      const upperResponse = response.trim().toUpperCase();
      return {
        recommendation: upperResponse.includes('BUY') ? 'BUY_NOW' : 'WAIT',
        confidence: 'MEDIUM',
      };
    } catch (error) {
      this.logger.error('Error getting flight recommendation', error);
      return {
        recommendation: 'WAIT', // Conservative default
        confidence: 'LOW',
      };
    }
  }

  /**
   * Batch process multiple flights
   */
  async batchFlightRecommendations(
    flights: FlightPredictionDTO[],
  ): Promise<(PredictionResponseDTO | null)[]> {
    try {
      // Process in parallel with rate limiting
      const batchSize = 5; // Process 5 at a time to avoid rate limits
      const results: (PredictionResponseDTO | null)[] = [];

      for (let i = 0; i < flights.length; i += batchSize) {
        const batch = flights.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map((flight) =>
            this.getFlightRecommendation(flight).catch((error) => {
              this.logger.error(
                `Error processing flight ${flight.route}`,
                error,
              );
              return null;
            }),
          ),
        );
        results.push(...batchResults);

        // Small delay between batches
        if (i + batchSize < flights.length) {
          await this.delay(500);
        }
      }

      return results;
    } catch (error) {
      this.logger.error('Error in batch flight recommendations', error);
      return flights.map(() => null);
    }
  }

  private calculateDaysUntilDeparture(departureDate: string): number {
    const departure = new Date(departureDate);
    const today = new Date();
    const diffTime = departure.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Clear a specific chat session
   */
  clearSession(sessionId: string): boolean {
    if (this.chatSessions[sessionId]) {
      delete this.chatSessions[sessionId];
      this.logger.log(`Session ${sessionId} cleared`);
      return true;
    }
    return false;
  }

  /**
   * Get all active session IDs
   */
  getActiveSessions(): string[] {
    return Object.keys(this.chatSessions);
  }
}
