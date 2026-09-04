import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    if (!authHeader) throw new UnauthorizedException('No token provided');
    
    const token = authHeader.split(' ')[1];
    if (!token) throw new UnauthorizedException('Malformed token');

    try {
       const payload = this.authService.verifyToken(token);
       request.user = payload; // Inject payload into request
       return true;
    } catch(e) {
       throw new UnauthorizedException('Invalid token');
    }
  }
}
