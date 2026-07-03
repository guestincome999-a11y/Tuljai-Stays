import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '@tuljai/types';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import {
  CreateReviewDto,
  ListReviewsQueryDto,
  ModerateReviewDto,
  ReportReviewDto,
} from './dto/review.dto';
import { ReviewsService } from './reviews.service';

@Controller()
export class ReviewsController {
  public constructor(private readonly reviewsService: ReviewsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('reviews')
  public create(@Body() dto: CreateReviewDto, @CurrentUser() user: AuthenticatedUser) {
    return this.reviewsService.create(dto, user);
  }

  @Get('lodges/:lodgeId/reviews')
  public listPublic(@Param('lodgeId') lodgeId: string, @Query() query: ListReviewsQueryDto) {
    return this.reviewsService.listPublic(lodgeId, query);
  }

  @UseGuards(JwtAuthGuard)
  @Post('reviews/:id/report')
  public report(
    @Param('id') id: string,
    @Body() dto: ReportReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviewsService.report(id, dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('admin/reviews')
  public listAdmin(@Query() query: ListReviewsQueryDto) {
    return this.reviewsService.listAdmin(query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('admin/reviews/:id/status')
  public moderate(
    @Param('id') id: string,
    @Body() dto: ModerateReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviewsService.moderate(id, dto, user);
  }
}
