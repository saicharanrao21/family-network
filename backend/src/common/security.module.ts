import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthGuard } from './auth.guard';

@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [AuthGuard],
  exports: [JwtModule, AuthGuard],
})
export class SecurityModule {}
