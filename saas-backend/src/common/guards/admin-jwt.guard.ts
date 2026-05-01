import {
  Injectable,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { AdminJwtPayload } from '../types/tenant-request.interface';

@Injectable()
export class AdminJwtGuard extends AuthGuard('admin-jwt') {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  handleRequest<TUser = AdminJwtPayload>(err: any, user: TUser, info: any): TUser {
    if (err || !user) {
      throw err || new UnauthorizedException(
        info?.message || 'Token administrateur manquant ou invalide',
      );
    }

    const payload = user as unknown as AdminJwtPayload;
    if (payload.scope !== 'platform-admin') {
      throw new ForbiddenException(
        'Accès réservé aux administrateurs de la plateforme',
      );
    }

    return user;
  }
}
