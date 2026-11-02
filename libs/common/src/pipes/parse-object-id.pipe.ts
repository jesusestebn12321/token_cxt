import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isValidObjectId } from 'mongoose';

/** Valida que el parámetro sea un ObjectId de MongoDB (24 hex). */
@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value) || !isValidObjectId(value)) {
      throw new BadRequestException('El identificador no es un ObjectId válido');
    }
    return value;
  }
}
