import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class PriceHistory extends Document {
  @Prop({ required: true, uppercase: true })
  origin: string;

  @Prop({ required: true, uppercase: true })
  destination: string;

  @Prop({ required: true })
  departureDate: string; // "YYYY-MM-DD"

  @Prop({ required: true })
  price: number;

  @Prop({ default: 'CAD' })
  currency: string;

  @Prop({ required: true })
  daysUntilFlight: number; // how many days before departure this was recorded

  @Prop({ default: Date.now })
  recordedAt: Date;
}

export const PriceHistorySchema = SchemaFactory.createForClass(PriceHistory);

// Index for fast route queries
PriceHistorySchema.index({ origin: 1, destination: 1, departureDate: 1 });
