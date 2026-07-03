import { Controller, Get } from '@nestjs/common';

interface HealthResponse {
  status: 'ok';
  service: 'tuljai-stays-api';
  timestamp: string;
}

@Controller('health')
export class HealthController {
  @Get()
  public check(): HealthResponse {
    return {
      status: 'ok',
      service: 'tuljai-stays-api',
      timestamp: new Date().toISOString(),
    };
  }
}
