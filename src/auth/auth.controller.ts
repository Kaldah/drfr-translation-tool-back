import { Body, Controller, InternalServerErrorException, Logger, Post } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { IsString } from 'class-validator'
import { EnvironmentVariables } from 'src/env'
import { RoutesService } from 'src/routes/routes.service'

export class ConfirmAuthQueryDto {
  @IsString()
  code: string
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly routesService: RoutesService,
    private readonly configService: ConfigService<EnvironmentVariables>
  ) {}

  @Post('confirm')
  async confirmAuth(@Body() query: ConfirmAuthQueryDto) {
    const clientId = this.configService.get('GITHUB_APP_CLIENT_ID', { infer: true })
    const clientSecret = this.configService.get('GITHUB_APP_CLIENT_SECRET', { infer: true })
    if (!clientId || !clientSecret) {
      throw new InternalServerErrorException('Missing GitHub app env variables')
    }

    const urlSearchParams = new URLSearchParams()
    urlSearchParams.append('client_id', clientId)
    urlSearchParams.append('client_secret', clientSecret)
    urlSearchParams.append('code', query.code)

    const response = await fetch(this.routesService.GITHUB_ROUTES.ACCESS_TOKEN + '?' + urlSearchParams.toString(), {
      method: 'POST'
    })

    if (!response.ok) {
      Logger.error(
        `Failed to get access token, got ${response.status} ${response.statusText} for ${this.routesService.GITHUB_ROUTES.ACCESS_TOKEN} ${await response.text()}`
      )
      throw new InternalServerErrorException('Failed to get access token')
    }

    const data = await response.text()
    const responseParams = new URLSearchParams(data)
    const accessToken = responseParams.get('access_token')
    if (!accessToken) {
      Logger.error(`Failed to get access token, got ${data}`)
      throw new InternalServerErrorException('Failed to get access token')
    }

    Logger.log('Got access token', urlSearchParams.toString())

    return { ok: 'Ok' }
  }
}
