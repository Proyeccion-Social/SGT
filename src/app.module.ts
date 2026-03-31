import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SessionExecutionModule } from './modules/session-execution/session-execution.module';

@Module({
  imports: [SessionExecutionModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
