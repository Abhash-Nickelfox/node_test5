import { Controller, Post, Get, Req, Res, Body, UseGuards, UnauthorizedException, HttpStatus } from '@nestjs/common';
import { Response, Request as ExpressRequest } from 'express';
import { AuthService } from '@modules/auth/auth.service';
import { LocalAuthGuard } from '@modules/auth/guards/local-auth.guard';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { Public } from '@common/decorators/public.decorator';
import { LoginDto } from '@modules/auth/dto/login.dto';
import { RegisterDto } from '@modules/auth/dto/register.dto';
import { User } from '@modules/users/entities/user.entity';
import { Role } from '@modules/users/entities/role.entity'; // Import Role entity
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('register')
  async register(@Body() registerDto: RegisterDto): Promise<User> {
    return this.authService.register(registerDto);
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Req() req: ExpressRequest, @Res({ passthrough: true }) res: Response, @Body() loginDto: LoginDto) {
    const user = req.user as User;
    const { accessToken, refreshToken } = await this.authService.getTokens(user);

    const refreshExpiration = this.configService.get<string>('JWT_REFRESH_EXPIRATION') ?? '7d';
    const expiryDays = parseInt(refreshExpiration.replace('d', ''), 10);
    const maxAge = expiryDays * 24 * 60 * 60 * 1000; // Convert days to milliseconds

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: maxAge,
    });

    return { accessToken, user: { id: user.id, email: user.email, roles: user.roles.map((role: Role) => role.name) } };
  }

  @Public()
  @Post('refresh')
  async refresh(@Req() req: ExpressRequest, @Res({ passthrough: true }) res: Response) {
    const oldRefreshToken = req.cookies['refreshToken'];
    if (!oldRefreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    const user = await this.authService.validateRefreshToken(oldRefreshToken);
    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.authService.invalidateRefreshToken(oldRefreshToken); // Invalidate old token

    const { accessToken, refreshToken } = await this.authService.getTokens(user);

    const refreshExpiration = this.configService.get<string>('JWT_REFRESH_EXPIRATION') ?? '7d';
    const expiryDays = parseInt(refreshExpiration.replace('d', ''), 10);
    const maxAge = expiryDays * 24 * 60 * 60 * 1000; // Convert days to milliseconds

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: maxAge,
    });

    return { accessToken, user: { id: user.id, email: user.email, roles: user.roles.map((role: Role) => role.name) } };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() req: ExpressRequest, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies['refreshToken'];
    if (refreshToken) {
      await this.authService.invalidateRefreshToken(refreshToken);
    }
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
    res.status(HttpStatus.OK).json({ message: 'Logged out successfully' });
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Req() req: ExpressRequest) {
    const user = req.user as User;
    return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, roles: user.roles.map((role: Role) => role.name) };
  }
}
