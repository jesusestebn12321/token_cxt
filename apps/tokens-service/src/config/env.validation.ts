import { plainToInstance } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  @Matches(/^mongodb(\+srv)?:\/\//, {
    message: 'MONGODB_URI debe empezar por mongodb:// o mongodb+srv://',
  })
  MONGODB_URI!: string;
}

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const details = errors
      .map((error) => `${error.property}: ${Object.values(error.constraints ?? {}).join(', ')}`)
      .join('\n  ');
    throw new Error(`Variables de entorno inválidas:\n  ${details}`);
  }
  return config;
}
