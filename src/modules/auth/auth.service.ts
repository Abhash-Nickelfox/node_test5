import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '@modules/users/entities/user.entity';
import { RefreshToken } from '@modules/auth/entities/refresh-token.entity';
import { RegisterDto } from '@modules/auth/dto/register.dto';
import { Role } from '@modules/users/entities/role.entity';
import { RoleEnum } from '@common/enums/role.enum';
import { MailService } from '@modules/mail/mail.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokensRepository: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService, // Injected MailService
  ) {}

  async register(registerDto: RegisterDto): Promise<User> {
    const { email, password, roles: roleEnums, ...rest } = registerDto;

    const existingUser = await this.usersRepository.findOne({ where: { email } });
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = this.usersRepository.create({
      email,
      passwordHash,
      isActive: true,
      ...rest,
    });

    let assignedRoles: Role[] = [];
    if (roleEnums && roleEnums.length > 0) {
      assignedRoles = await this.rolesRepository.find({
        where: { name: In(roleEnums) },
      });
      if (assignedRoles.length !== roleEnums.length) {
        this.logger.warn(`Some roles not found during registration: ${roleEnums.filter((re: RoleEnum) => !assignedRoles.some((r: Role) => r.name === re)).join(', ')}`);
      }
    } else {
      // Assign default 'VIEWER' role if no roles are provided
      const defaultRole = await this.rolesRepository.findOne({ where: { name: RoleEnum.VIEWER as any } });
      if (defaultRole) {
        assignedRoles = [defaultRole];
      } else {
        this.logger.error('Default VIEWER role not found during user registration.');
      }
    }
    user.roles = assignedRoles;

    const savedUser = await this.usersRepository.save(user);

    // Send welcome email
    try {
      await this.mailService.sendWelcome(savedUser.email, savedUser.firstName || 'User');
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${savedUser.email}: ${(error as Error).message}`);
    }

    return savedUser;
  }

  async validateUser(email: string, pass: string): Promise<User | null> {
    const user = await this.usersRepository.findOne({ where: { email }, relations: ['roles'] });
    if (user && user.isActive && await bcrypt.compare(pass, user.passwordHash)) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash, ...result } = user;
      return result as User;
    }
    return null;
  }

  async login(user: User) {
    const payload = { email: user.email, sub: user.id, roles: user.roles.map((role: Role) => role.name) };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = await this.createRefreshToken(user.id);

    return {
      accessToken,
      refreshToken: refreshToken.token,
    };
  }

  async getTokens(user: User) {
    const payload = { email: user.email, sub: user.id, roles: user.roles.map((role: Role) => role.name) };
    const accessToken = this.jwtService.sign(payload);

    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    if (!refreshSecret) throw new Error('JWT_REFRESH_SECRET is not set');

    const refreshToken = this.jwtService.sign(payload, {
      secret: refreshSecret,
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRATION') ?? '7d',
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  async createRefreshToken(userId: string): Promise<RefreshToken> {
    const refreshTokenExpiration = this.configService.get<string>('JWT_REFRESH_EXPIRATION') ?? '7d';
    const expiryDays = parseInt(refreshTokenExpiration.replace('d', ''), 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    const token = crypto.randomUUID(); // Generate a UUID for the refresh token

    const newRefreshToken = this.refreshTokensRepository.create({
      userId: userId,
      token: token,
      expiresAt: expiresAt,
    });

    return this.refreshTokensRepository.save(newRefreshToken);
  }

  async validateRefreshToken(token: string): Promise<User | null> {
    const refreshToken = await this.refreshTokensRepository.findOne({
      where: { token },
      relations: ['user'],
    });

    if (!refreshToken || refreshToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Ensure user is loaded with roles
    const user = await this.usersRepository.findOne({
      where: { id: refreshToken.userId },
      relations: ['roles'],
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User associated with refresh token is inactive or not found');
    }

    return user;
  }

  async invalidateRefreshToken(token: string): Promise<void> {
    await this.refreshTokensRepository.delete({ token });
  }
}
