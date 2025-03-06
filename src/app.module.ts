import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { AuthModule } from './auth/auth.module'
import { ConfigModule } from '@nestjs/config'
import { SmeeModule } from './smee/smee.module'
import { RoutesModule } from './routes/routes.module'

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule, SmeeModule, RoutesModule],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
