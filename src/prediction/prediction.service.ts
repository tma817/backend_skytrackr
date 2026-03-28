import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Anthropic from '@anthropic-ai/sdk';
import { PriceHistory } from 'src/watchlist/schemas/price-history.schema';
import { PriceGrid } from 'src/flights/schemas/price-grid.schema';

export interface PricePrediction {
  origin: string;
  destination: string;
  departureDate: string;
  currency: string;
  currentLowestPrice: number | null;
  predictedPrice: number | null;
  priceRange: { low: number; high: number } | null;
  trend: 'rising' | 'falling' | 'stable' | 'unknown';
  recommendation: 'buy_now' | 'wait' | 'uncertain';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  dataPoints: number;
}

@Injectable()
export class PredictionService {
  private readonly logger = new Logger(PredictionService.name);
  private readonly anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  constructor(
    @InjectModel(PriceHistory.name) private priceHistoryModel: Model<PriceHistory>,
    @InjectModel(PriceGrid.name) private priceGridModel: Model<PriceGrid>,
  ) {}

  async predictPrice(
    origin: string,
    destination: string,
    departureDate: string,
    currency: string = 'CAD',
  ): Promise<PricePrediction> {
    // Gather historical price snapshots for this route
    const history = await this.priceHistoryModel
      .find({ origin, destination, departureDate })
      .sort({ recordedAt: 1 })
      .lean();

    // Gather current price grid data for same route (any month)
    const yearMonth = departureDate.substring(0, 7);
    const priceGrid = await this.priceGridModel
      .findOne({ origin, destination, yearMonth, currency })
      .lean();

    const currentGridPrice =
      priceGrid?.data?.find((d) => d.date === departureDate)?.price ?? null;

    const dataPoints = history.length;

    // If no data at all, return unknown prediction
    if (dataPoints === 0 && currentGridPrice === null) {
      return {
        origin,
        destination,
        departureDate,
        currency,
        currentLowestPrice: null,
        predictedPrice: null,
        priceRange: null,
        trend: 'unknown',
        recommendation: 'uncertain',
        confidence: 'low',
        reasoning:
          'No historical price data available for this route yet. Add this flight to your watchlist to start building price history.',
        dataPoints: 0,
      };
    }

    // Build context for Claude
    const historyContext =
      dataPoints > 0
        ? history
            .map(
              (h) =>
                `- Recorded ${h.recordedAt.toISOString().split('T')[0]}: $${h.price} ${h.currency} (${h.daysUntilFlight} days before departure)`,
            )
            .join('\n')
        : 'No historical snapshots yet.';

    const currentPrice = currentGridPrice ?? history[history.length - 1]?.price ?? null;

    const prompt = `You are a flight price prediction expert. Analyze the following price data for a flight route and predict whether the price will go up or down.

ROUTE: ${origin} → ${destination}
DEPARTURE DATE: ${departureDate}
CURRENCY: ${currency}
CURRENT LOWEST PRICE: ${currentPrice ? `$${currentPrice}` : 'Unknown'}

PRICE HISTORY (${dataPoints} data points):
${historyContext}

${priceGrid?.data?.length ? `RECENT PRICE GRID (${priceGrid.data.length} dates around departure):\n${priceGrid.data.map((d) => `- ${d.date}: $${d.price}`).join('\n')}` : ''}

Based on this data, provide your prediction. Consider:
- Price trend over time (rising, falling, stable)
- How far the departure date is from today (${this.daysFromToday(departureDate)} days away)
- General airline pricing patterns (prices usually rise as departure approaches)
- Any significant price changes in the data

Respond ONLY with a valid JSON object in this exact format, no other text:
{
  "predictedPrice": <number or null>,
  "priceRange": { "low": <number>, "high": <number> } or null,
  "trend": "rising" | "falling" | "stable" | "unknown",
  "recommendation": "buy_now" | "wait" | "uncertain",
  "confidence": "high" | "medium" | "low",
  "reasoning": "<1-2 sentence plain English explanation>"
}`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      const textBlock = response.content.find((b) => b.type === 'text');
      const rawText = textBlock && textBlock.type === 'text' ? textBlock.text.trim() : '';

      // Extract JSON from response
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in Claude response');

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        origin,
        destination,
        departureDate,
        currency,
        currentLowestPrice: currentPrice,
        predictedPrice: parsed.predictedPrice ?? null,
        priceRange: parsed.priceRange ?? null,
        trend: parsed.trend ?? 'unknown',
        recommendation: parsed.recommendation ?? 'uncertain',
        confidence: parsed.confidence ?? 'low',
        reasoning: parsed.reasoning ?? '',
        dataPoints,
      };
    } catch (error: any) {
      this.logger.error(`Claude prediction failed: ${error.message}`);
      return {
        origin,
        destination,
        departureDate,
        currency,
        currentLowestPrice: currentPrice,
        predictedPrice: null,
        priceRange: null,
        trend: 'unknown',
        recommendation: 'uncertain',
        confidence: 'low',
        reasoning: 'Prediction service is temporarily unavailable. Please try again later.',
        dataPoints,
      };
    }
  }

  private daysFromToday(dateStr: string): number {
    const departure = new Date(dateStr);
    const today = new Date();
    return Math.ceil((departure.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }
}
