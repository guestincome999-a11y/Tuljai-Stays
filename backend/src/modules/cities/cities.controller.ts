import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import type { City } from '@tuljai/types';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { CitiesService } from './cities.service';
import { CreateCityDto } from './dto/city.dto';

@Controller()
export class CitiesController {
  public constructor(private readonly citiesService: CitiesService) {}

  @Get('cities')
  public listActive(): Promise<City[]> {
    return this.citiesService.listActive();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('admin/cities')
  public create(@Body() dto: CreateCityDto): Promise<City> {
    return this.citiesService.create(dto);
  }
}
