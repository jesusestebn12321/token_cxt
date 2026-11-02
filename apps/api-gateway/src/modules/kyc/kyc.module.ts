import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';
import { KycSubmission, KycSubmissionSchema } from './schemas/kyc-submission.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: KycSubmission.name, schema: KycSubmissionSchema }])],
  controllers: [KycController],
  providers: [KycService],
  exports: [KycService],
})
export class KycModule {}
