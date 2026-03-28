import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

class CarryOn {
  @Prop() included: boolean;
  @Prop() weightKg: number;
  @Prop() dimensions: string; // e.g. "55×40×23 cm"
  @Prop() personalItemAllowed: boolean;
}

class CheckedBaggage {
  @Prop() freeAllowance: number;      // number of free bags (0, 1, 2)
  @Prop() weightKgPerBag: number;     // e.g. 23
  @Prop() maxWeightKg: number;        // max allowed (e.g. 32)
  @Prop() firstBagFeeUSD: number;
  @Prop() secondBagFeeUSD: number;
  @Prop() additionalBagFeeUSD: number;
  @Prop() overweightFeeUSD: number;   // per kg over limit
  @Prop() oversizeFeeUSD: number;
}

class Services {
  @Prop() wifi: string;               // "free" | "paid" | "none"
  @Prop({ type: Number, default: null }) wifiPriceUSD: number;
  @Prop() meals: string;              // "included" | "paid" | "none"
  @Prop() entertainment: string;      // "seatback" | "streaming" | "none"
  @Prop() seatSelection: string;      // "free" | "paid" | "elite only"
  @Prop() priorityBoarding: boolean;
  @Prop() loungeAccess: string;       // "business only" | "all classes" | "none"
  @Prop() powerOutlets: boolean;
  @Prop() usb: boolean;
}

class Fees {
  @Prop({ type: Number, default: null }) seatSelectionEconomyUSD: number;
  @Prop({ type: Number, default: null }) seatSelectionBusinessUSD: number;
  @Prop({ type: Number, default: null }) cancellationFeeUSD: number;
  @Prop({ type: Number, default: null }) changeFeeUSD: number;
  @Prop({ type: Number, default: null }) noShowFeeUSD: number;
  @Prop() note: string;
}

class Policies {
  @Prop() onlineCheckIn: string;      // e.g. "24–48 hours before departure"
  @Prop() airportCheckIn: string;     // e.g. "3 hours before departure"
  @Prop() boardingCutoff: string;     // e.g. "15 minutes before departure"
  @Prop() refundPolicy: string;
  @Prop() infantPolicy: string;
  @Prop() petPolicy: string;
  @Prop() idRequirement: string;
}

@Schema({ timestamps: true, collection: 'airline_policies' })
export class AirlinePolicy extends Document {
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  iata: string;

  @Prop({ required: true })
  name: string;

  @Prop() country: string;
  @Prop() hub: string;
  @Prop() alliance: string;
  @Prop() logo: string;
  @Prop() website: string;
  @Prop() founded: number;
  @Prop() headquarters: string;
  @Prop({ type: [String] }) fleet: string[];

  @Prop({ type: CarryOn })
  carryOn: CarryOn;

  @Prop({ type: CheckedBaggage })
  checkedBaggage: CheckedBaggage;

  @Prop({ type: Services })
  services: Services;

  @Prop({ type: Fees })
  fees: Fees;

  @Prop({ type: Policies })
  policies: Policies;
}

export const AirlinePolicySchema = SchemaFactory.createForClass(AirlinePolicy);
