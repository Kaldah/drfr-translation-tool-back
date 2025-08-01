import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { AuthModule } from './auth/auth.module'
import { ConfigModule } from '@nestjs/config'
import { SmeeModule } from './smee/smee.module'
import { RoutesModule } from './routes/routes.module'
import { plainToInstance } from 'class-transformer'
import { EnvironmentVariables } from 'src/env'
import { TranslationModule } from './translation/translation.module'
import { CacheModule } from '@nestjs/cache-manager'
import { GithubModule } from './github/github.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => plainToInstance(EnvironmentVariables, config)
    }),
    CacheModule.register({ isGlobal: true }),
    AuthModule,
    SmeeModule,
    RoutesModule,
    TranslationModule,
    GithubModule
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
