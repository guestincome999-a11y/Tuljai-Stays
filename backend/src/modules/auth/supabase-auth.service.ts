import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface GoogleIdentityProfile {
  email: string | null;
  fullName: string;
  providerSubject: string;
}

@Injectable()
export class SupabaseAuthService {
  private readonly client: SupabaseClient | null;

  public constructor(configService: ConfigService) {
    const url = configService.get<string>('api.supabase.url');
    const serviceRoleKey = configService.get<string>('api.supabase.serviceRoleKey');

    this.client =
      url && serviceRoleKey
        ? createClient(url, serviceRoleKey, {
            auth: {
              autoRefreshToken: false,
              detectSessionInUrl: false,
              persistSession: false,
            },
          })
        : null;
  }

  public async verifyGoogleAccessToken(accessToken: string): Promise<GoogleIdentityProfile> {
    if (!this.client) {
      throw new ServiceUnavailableException('Google login is not configured');
    }

    const { data, error } = await this.client.auth.getUser(accessToken);
    if (error || !data.user) {
      throw new UnauthorizedException('Invalid or expired Google login');
    }

    const googleIdentity = data.user.identities?.find((identity) => identity.provider === 'google');
    if (!googleIdentity) {
      throw new UnauthorizedException('The supplied login is not a Google identity');
    }

    const fullName = this.readGoogleName(data.user.user_metadata);
    if (!fullName) {
      throw new BadRequestException('The Google account does not provide a profile name');
    }

    return {
      email: data.user.email ?? null,
      fullName,
      providerSubject: googleIdentity.identity_id,
    };
  }

  private readGoogleName(metadata: Record<string, unknown>): string | null {
    for (const key of ['full_name', 'name']) {
      const value = metadata[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }

    return null;
  }
}
