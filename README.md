# TUA Monitor

Aplicación operativa para registrar viajes, paradas, llegadas y cambios auditados de Transportadores TUA.

## Desarrollo local

1. Copia `.env.local.example` como `.env.local`.
2. Completa `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` con los valores del proyecto Supabase.
3. Instala y verifica:

```bash
npm install
npm run test
npm run lint
npx tsc --noEmit
npm run build
```

No confirmes `.env.local` ni claves de servicio en Git.

## Documentación

- [Guía operativa y de recuperación](docs/OPERATIONS_GUIDE.md)
- [Controles dinámicos, roles y auditoría](docs/SUPABASE_DYNAMIC_CONTROLS.md)
