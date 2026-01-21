import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class Airport extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  city: string;

  @Prop({ required: true })
  country: string;

  @Prop({ required: true, index: true })
  iata: string;

  @Prop()
  icao: string;

  @Prop({ type: [Number], index: '2dsphere' })
  coordinates: number[];
}

export const AirportSchema = SchemaFactory.createForClass(Airport);

AirportSchema.index({ name: 'text', city: 'text', iata: 'text' });