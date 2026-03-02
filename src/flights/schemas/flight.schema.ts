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
  @Prop({ required: true, uppercase: true, trim: true })
  origin: string;

  @Prop({ required: true, uppercase: true, trim: true })
  destination: string;

  @Prop({ required: true })
  departureDate: string;

  @Prop({ default: null })
  returnDate?: string;

  @Prop({ required: true, min: 1 })
  adults: number;

  @Prop({ type: Array })
  results: any[];

  @Prop({ type: [AIPrediction], default: [] })
  aiPredictions: AIPrediction[]; // CACHE FOR AI PREDICTIONS

  @Prop({ default: false })
  aiProcessed: boolean; // FLAG TO CHECK IF AI PROCESSING IS DONE
}

export const FlightSearchSchema = SchemaFactory.createForClass(FlightSearch);


FlightSearchSchema.index({ 
  origin: 1, 
  destination: 1, 
  departureDate: 1, 
  returnDate: 1, 
  adults: 1 
});

// DO THAT LATER ON
// FlightSearchSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2000 });