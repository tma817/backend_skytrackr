import { Controller, Get, Query } from "@nestjs/common";
import { AirlinesService } from "./airlines.service";


@Controller('airlines')
export class AirlinesController{
    constructor(private readonly airlinesService: AirlinesService){}

    @Get('search')
    async search(@Query('code') code: string){
        if (!code) return;
        return await this.airlinesService.getAirlineByIata(code);
    }

}