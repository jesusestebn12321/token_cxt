import { Permission } from '../enums/permission.enum';

export const ACCESS_ACTIONS = ['read', 'create', 'update', 'delete'] as const;
export type AccessAction = (typeof ACCESS_ACTIONS)[number];

export const ACCESS_MODULES = [{ key: 'users', label: 'Usuarios' }] as const;

export type AccessModule = (typeof ACCESS_MODULES)[number]['key'];

const ACTION_LABEL: Record<AccessAction, string> = {
  read: 'Leer',
  create: 'Crear',
  update: 'Editar',
  delete: 'Eliminar',
};

export function permissionCode(module: AccessModule, action: AccessAction): Permission {
  return `${module}:${action}` as Permission;
}

export function isAccessModule(value: string): value is AccessModule {
  return ACCESS_MODULES.some((item) => item.key === value);
}

export function isAccessAction(value: string): value is AccessAction {
  return (ACCESS_ACTIONS as readonly string[]).includes(value);
}

export function catalog() {
  return {
    modules: ACCESS_MODULES.map((item) => ({
      ...item,
      actions: ACCESS_ACTIONS.map((action) => ({
        key: action,
        label: ACTION_LABEL[action],
        permission: permissionCode(item.key, action),
      })),
    })),
  };
}

export interface ModuleGrant {
  module: AccessModule;
  actions: AccessAction[];
}

export function grantsToPermissions(grants: ModuleGrant[]): Permission[] {
  const codes = grants.flatMap((grant) => grant.actions.map((action) => permissionCode(grant.module, action)));
  return [...new Set(codes)];
}

export function permissionsToGrants(permissions: readonly string[]): ModuleGrant[] {
  return ACCESS_MODULES.map((item) => ({
    module: item.key,
    actions: ACCESS_ACTIONS.filter((action) => permissions.includes(permissionCode(item.key, action))),
  })).filter((grant) => grant.actions.length > 0);
}
