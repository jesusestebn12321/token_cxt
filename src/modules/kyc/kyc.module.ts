import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AmlScreening } from './entities/aml-screening.entity';
import { KycDocument } from './entities/kyc-document.entity';
import { KycSubmission } from './entities/kyc-submission.entity';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';

@Module({
  imports: [TypeOrmModule.forFeature([KycSubmission, KycDocument, AmlScreening])],
  controllers: [KycController],
  providers: [KycService],
  exports: [KycService],
})
export class KycModule {}
