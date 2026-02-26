import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '@common/decorators/roles.decorator';
import { RoleEnum } from '@common/enums/role.enum';
import { IS_PUBLIC_KEY } from '@common/decorators/public.decorator';
import { Role } from '@modules/users/entities/role.entity';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<RoleEnum[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      return true; // No roles specified, allow access
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.roles) {
      return false; // User or user roles not found
    }

    return requiredRoles.some((role: RoleEnum) => user.roles.some((userRole: Role) => userRole.name === role));
  }
}
