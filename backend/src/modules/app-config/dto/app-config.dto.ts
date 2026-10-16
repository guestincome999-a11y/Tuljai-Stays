import { Allow } from 'class-validator';

export class UpdatePilgrimLayoutDto {
  @Allow()
  layout!: unknown;
}
