import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Watchlist extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  userEmail: string;

  @Prop({ required: true })
  searchId: string;

  @Prop({ required: true })
  flightId: string;

  @Prop({ required: true })
  origin: string;

  @Prop({ required: true })
  destination: string; 

  @Prop({ required: true })
  initialPrice: number; 

  @Prop({ required: true })
  currentPrice: number;

  @Prop()
  departureDate: string;

  @Prop()
  returnDate?: string;

  @Prop()
  departureTime?: string;

  @Prop()
  returnTime?: string;

  @Prop({ default: 'active' })
  status: string;

  @Prop({ required: true })
  passengers: number;

  @Prop({ required: true, enum: ['one-way', 'round-trip'] })
  tripType: string;

  @Prop()
  airlineName: string;

  @Prop()
  airlineLogo: string;

  @Prop({ default: 'CAD' })
  currency: string;

  @Prop({ type: [{ 
    carrierCode: String, 
    flightNumber: String,
    departure: { iataCode: String, date: String, time: String },
    arrival: { iataCode: String, date: String, time: String },
}], default: [] })
segments: Array<{
    carrierCode: string;
    flightNumber: string;
    departure: { iataCode: string; date: string; time: string; };
    arrival: { iataCode: string; date: string; time: string; };
}>;
}

export const WatchlistSchema = SchemaFactory.createForClass(Watchlist);
