import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Watchlist extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

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

  @Prop({ default: 'active' })
  status: string;
}

export const WatchlistSchema = SchemaFactory.createForClass(Watchlist);
