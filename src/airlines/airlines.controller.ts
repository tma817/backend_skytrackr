import { Controller, Get, Param, Query } from "@nestjs/common";
import { AirlinesService } from "./airlines.service";

@Controller('airlines')
export class AirlinesController {
    constructor(private readonly airlinesService: AirlinesService) {}

    @Get('search')
    async search(@Query('code') code: string) {
        if (!code) return;
        return await this.airlinesService.getAirlineByIata(code);
    }

    @Get('policies')
    async getPolicies(
        @Query('search') search?: string,
        @Query('alliance') alliance?: string,
    ) {
        return this.airlinesService.getAllPolicies(search, alliance);
    }

    @Get('policies/:iata')
    async getPolicy(@Param('iata') iata: string) {
        return this.airlinesService.getPolicyByIata(iata);
    }
}
