import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Booking extends Document {
  @Prop()
  userId: string;

  @Prop({ required: true })
  amadeusOrderId: string;  // id returned by Amadeus flight-orders

  @Prop()
  pnr: string;             // GDS Passenger Name Record (e.g. "ABC123")

  @Prop({ type: Object, required: true })
  flightOffer: any;        // raw flight offer used for the booking

  @Prop({ type: Array, required: true })
  travelers: any[];

  @Prop({ type: Array, default: [] })
  seatings: { segmentId: string; travelerId: string; seatNumber: string }[];

  @Prop({ required: true })
  totalPrice: string;

  @Prop({ required: true })
  currency: string;

  @Prop({ default: 'CONFIRMED' })
  status: string;
}

export const BookingSchema = SchemaFactory.createForClass(Booking);
