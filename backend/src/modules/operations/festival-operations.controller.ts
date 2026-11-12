import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedUser } from '@tuljai/types';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import {
  FestivalModeDto,
  FestivalQueryDto,
  LodgeOperationDto,
  ManualCheckinDto,
  RecoveryReasonDto,
} from './dto/festival-operations.dto';
import { FestivalOperationsService } from './festival-operations.service';

@Controller('admin/festival-operations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class FestivalOperationsController {
  constructor(private readonly operations: FestivalOperationsService) {}

  @Get()
  snapshot(@Query() query: FestivalQueryDto) {
    return this.operations.snapshot(query);
  }

  @Patch('mode')
  updateMode(@Body() dto: FestivalModeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.operations.updateMode(dto, user.id);
  }

  @Patch('lodges/:id')
  updateLodge(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LodgeOperationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.operations.updateLodge(id, dto, user.id);
  }

  @Post('payments/:id/reconcile')
  retryPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecoveryReasonDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.operations.retryPayment(id, dto.reason, user.id);
  }

  @Post('recovery/checkin')
  manualCheckin(@Body() dto: ManualCheckinDto, @CurrentUser() user: AuthenticatedUser) {
    return this.operations.manualCheckin(dto, user);
  }
}
