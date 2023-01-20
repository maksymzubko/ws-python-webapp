import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppGateway } from './app.gateway';
import {HelperService} from "../helper/helper.service";

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, AppGateway, HelperService],
})
export class AppModule {}
