// Se ejecuta UNA vez, al crear el volumen de datos (mongosh, con el usuario root ya creado).
// Crea el usuario de la aplicación con permisos mínimos (readWrite solo sobre su base).
const dbName = process.env.MONGO_DB || 'rwa_backoffice';
const appUser = process.env.MONGO_APP_USER || 'rwa_app';
const appPassword = process.env.MONGO_APP_PASSWORD;

if (!appPassword) {
  throw new Error('MONGO_APP_PASSWORD no está definida');
}

const appDb = db.getSiblingDB(dbName);
appDb.createUser({
  user: appUser,
  pwd: appPassword,
  roles: [{ role: 'readWrite', db: dbName }],
});
print(`Usuario '${appUser}' creado con readWrite sobre '${dbName}'`);
