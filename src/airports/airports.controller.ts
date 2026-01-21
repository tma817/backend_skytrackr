import { Controller, Get, Query, Post } from '@nestjs/common';
import { AirportsService } from './airports.service';

@Controller('airports')
export class AirportsController {
  constructor(private readonly airportsService: AirportsService) {}

  @Get('search')
  async search(@Query('term') term: string) {
    if (!term) return [];
    return await this.airportsService.suggestAirports(term);
  }
}