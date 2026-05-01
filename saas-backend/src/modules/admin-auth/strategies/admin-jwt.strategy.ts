import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AdminJwtPayload } from '../../../common/types/tenant-request.interface';

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.adminSecret'),
    });
  }

  async validate(payload: any): Promise<AdminJwtPayload> {
    if (!payload?.sub || payload?.scope !== 'platform-admin') {
      throw new UnauthorizedException(
        'Token administrateur invalide ou scope incorrect',
      );
    }

    return {
      sub: payload.sub,
      email: payload.email,
      scope: 'platform-admin',
    };
  }
}
