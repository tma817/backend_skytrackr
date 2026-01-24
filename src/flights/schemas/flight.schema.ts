import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

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
}

export const FlightSearchSchema = SchemaFactory.createForClass(FlightSearch);