import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';

import { CatalogService } from './catalog.service';
import type { CatalogLodgeDetails, CatalogPage } from './catalog.types';
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
}
