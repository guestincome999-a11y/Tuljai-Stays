import { Injectable } from '@nestjs/common';
import type { City } from '@tuljai/types';

import { PrismaService } from '../prisma/prisma.service';

import type { CreateCityDto } from './dto/city.dto';

@Injectable()
export class CitiesService {
  public constructor(private readonly prisma: PrismaService) {}

  public async listActive(): Promise<City[]> {
    const cities = await this.prisma.city.findMany({
      orderBy: { name: 'asc' },
      where: {
        deletedAt: null,
        isActive: true,
      },
    });

    return cities.map((city) => ({
      country: city.country,
      id: city.id,
      isActive: city.isActive,
      name: city.name,
      slug: city.slug,
      state: city.state,
    }));
  }

  public async create(dto: CreateCityDto): Promise<City> {
    const city = await this.prisma.city.create({
      data: {
        country: dto.country,
        isActive: dto.isActive ?? true,
        name: dto.name,
        slug: dto.slug,
        state: dto.state,
      },
    });

    return {
      country: city.country,
      id: city.id,
      isActive: city.isActive,
      name: city.name,
      slug: city.slug,
      state: city.state,
    };
  }
}
