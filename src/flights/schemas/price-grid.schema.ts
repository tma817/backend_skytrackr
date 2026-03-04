import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class PriceGrid extends Document {
  @Prop({ required: true, uppercase: true })
  origin: string;

  @Prop({ required: true, uppercase: true })
  destination: string;

  /** "YYYY-MM" — one cache entry covers the whole month */
  @Prop({ required: true })
  yearMonth: string;

  @Prop({ default: 'CAD' })
  currency: string;

  @Prop({ default: true })
  oneWay: boolean;

  /** Array of { date: "YYYY-MM-DD", price: number } */
  @Prop({ type: Array, default: [] })
  data: { date: string; price: number }[];

  @Prop({ default: () => new Date() })
  cachedAt: Date;
}

export const PriceGridSchema = SchemaFactory.createForClass(PriceGrid);

// Fast lookup by route + month
PriceGridSchema.index(
  { origin: 1, destination: 1, yearMonth: 1, currency: 1, oneWay: 1 },
  { unique: true },
);

// Auto-expire documents after 6 hours
PriceGridSchema.index({ cachedAt: 1 }, { expireAfterSeconds: 21600 });
