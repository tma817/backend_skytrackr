
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export class UserPreferences {
  homeAirport?: string;
  budgetMax?: number;
  flexibility?: number;
  prefersDirect?: boolean;
  preferredCabin?: 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST';
}

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true })
  fname: string;

  @Prop({ required: true })
  lname: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop()
  phoneNumber?: string;

  @Prop()
  otpCode?: string;

  @Prop()
  otpExpires?: Date;

  @Prop({ default: false })
  isVerified: boolean;

  @Prop({ type: Object, default: null })
  preferences?: UserPreferences;
}

export const UserSchema = SchemaFactory.createForClass(User);