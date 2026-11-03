import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const OBJECT_ID = /^[a-f\d]{24}$/i;

/** Valida que el parámetro de ruta sea un ObjectId de MongoDB (24 hex). */
@Injectable()
export class ParseUuidPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== 'string' || !OBJECT_ID.test(value)) {
      throw new BadRequestException('El identificador no es un ObjectId válido');
    }
    return value;
  }
}
