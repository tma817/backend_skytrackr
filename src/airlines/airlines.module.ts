import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AirlineSchema } from "./schemas/airline.schema";
import { AirlinePolicySchema } from "./schemas/airline-policy.schema";
import { AirlinesController } from "./airlines.controller";
import { AirlinesService } from "./airlines.service";

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: 'Airline', schema: AirlineSchema },
            { name: 'AirlinePolicy', schema: AirlinePolicySchema },
        ]),
    ],
    controllers: [AirlinesController],
    providers: [AirlinesService],
    exports: [AirlinesService],
})
export class AirlinesModule {}
