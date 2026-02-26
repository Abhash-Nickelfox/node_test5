import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '@modules/users/users.service';
import { User } from '@modules/users/entities/user.entity';
import { Role } from '@modules/users/entities/role.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET env var is not set. Add it to .env');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any): Promise<User> {
    const user = await this.usersService.findOne(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }
    // Ensure roles are correctly typed as Role[]
    user.roles = payload.roles.map((roleName: string) => ({ name: roleName, id: '', createdAt: new Date(), updatedAt: new Date(), users: [] } as Role));
    return user;
  }
}
