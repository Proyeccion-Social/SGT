import { Global, Module } from '@nestjs/common';
import { ExternalConfigService } from './services/external-config.service';
import { ExternalConfigController } from './controllers/external-config.controller';

@Global()
@Module({
  controllers: [ExternalConfigController],
  providers: [ExternalConfigService],
  exports: [ExternalConfigService],
})
export class ExternalConfigModule {}
