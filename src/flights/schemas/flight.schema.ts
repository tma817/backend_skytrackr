import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

// NEW: Schema for AI prediction cache
class AIPrediction {
  @Prop()
  flightId: string;

  @Prop()
  recommendation: string; // 'BUY_NOW' | 'WAIT'

  @Prop()
  confidence: string; // 'HIGH' | 'MEDIUM' | 'LOW'
}

@Schema({ timestamps: true })
export class FlightSearch extends Document {
  @Prop()
  origin: string;

  @Prop()
  destination: string;

  @Prop()
  departureDate: string;

  @Prop()
  adults: number;

  @Prop({ type: Array })
  results: any[];

  @Prop({ type: [AIPrediction], default: [] })
  aiPredictions: AIPrediction[]; // CACHE FOR AI PREDICTIONS

  @Prop({ default: false })
  aiProcessed: boolean; // FLAG TO CHECK IF AI PROCESSING IS DONE
}

export const FlightSearchSchema = SchemaFactory.createForClass(FlightSearch);
