import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '@tuljai/types';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CatalogService } from './catalog.service';
import type { CatalogLodgeDetails, CatalogPage, MyBookingCard } from './catalog.types';
import { CatalogQueryDto } from './dto/catalog-query.dto';

@Controller('catalog')
export class CatalogController {
  public constructor(private readonly catalogService: CatalogService) {}

  @Get('lodges')
  public listLodges(@Query() query: CatalogQueryDto): Promise<CatalogPage> {
    return this.catalogService.listLodges(query);
  }

  @Get('lodges/:id')
  public getLodge(@Param('id', ParseUUIDPipe) id: string): Promise<CatalogLodgeDetails> {
    return this.catalogService.getLodge(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-bookings')
  public listMyBookings(@CurrentUser() user: AuthenticatedUser): Promise<MyBookingCard[]> {
    return this.catalogService.listMyBookings(user.id);
  }
}
