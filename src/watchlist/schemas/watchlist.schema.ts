import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WatchlistDocument = Watchlist & Document;

@Schema({ timestamps: true })
export class Watchlist {
  @Prop({ required: true })
  flight_number: string;

  @Prop({ required: true })
  user_id: string;
}

export const WatchlistSchema = SchemaFactory.createForClass(Watchlist);
