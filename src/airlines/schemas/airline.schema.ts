import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Airline extends Document {
    @Prop({ index: true })
    openFlightsId: number;

    @Prop({ required: true })
    name: string;

    @Prop()
    alias: string;

    @Prop({ 
      index: true, 
      uppercase: true, 
      trim: true,
      sparse: true 
    }) 
    iata: string; 

    @Prop({ uppercase: true, trim: true }) 
    icao: string; 

    @Prop()
    callsign: string;

    @Prop()
    country: string;

    @Prop()
    active: string;

    @Prop()
    logo: string;
}

export const AirlineSchema = SchemaFactory.createForClass(Airline);