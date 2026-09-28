# Guía operativa de TUA Monitor

Esta guía cubre la administración cotidiana, el despliegue y la recuperación básica de la aplicación. No contiene credenciales.

## Usuarios y roles

Los usuarios se crean en **Supabase > Authentication > Users**. Después se les asigna exactamente uno de estos roles en `public.user_roles`:

- `admin`: crea, edita, finaliza y reabre viajes; corrige controles y consulta la bitácora.
- `reporter`: consulta viajes y registra paradas o llegadas mientras el viaje está `EN_ROUTE`. No puede modificar un viaje finalizado.

Para asignar o cambiar el rol, usa el UUID real del usuario:

```sql
insert into public.user_roles (user_id, role)
values ('UUID_DEL_USUARIO', 'reporter')
on conflict (user_id) do update
set role = excluded.role,
    updated_at = now();
```

Después del cambio, el usuario debe recargar o navegar de nuevo para consultar el rol actualizado. Si la vista continúa desactualizada, puede cerrar sesión e ingresar otra vez. No otorgues `admin` como solución temporal a un problema de permisos.

## Operación diaria

1. El administrador crea el viaje.
2. Administradores y reporteros registran paradas o la llegada final mientras el viaje está en ruta.
3. La llegada final no finaliza el viaje automáticamente. Un administrador revisa la información y usa **Finalizar viaje**.
4. Un viaje finalizado queda en modo de solo lectura para el reportero.
5. Toda corrección administrativa sensible requiere un motivo y queda registrada en la bitácora con estado anterior y nuevo.

Si dos administradores editan el mismo registro, quien guarde con una versión desactualizada debe recargar y revisar antes de volver a intentarlo.

## Despliegue

La rama de producción es `main` y Vercel publica el proyecto `tua-monitor`. Antes de integrar cambios:

```bash
npm ci
npm run test
npm run lint
npx tsc --noEmit
npm run build
git diff --check
```

Variables requeridas en desarrollo y Vercel:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Para una entrega que incluya base de datos:

1. Revisa el inventario previo de `docs/SUPABASE_DYNAMIC_CONTROLS.md`.
2. Programa una ventana breve sin escrituras.
3. Aplica las migraciones de `supabase/migrations` en orden cronológico.
4. Publica el frontend compatible inmediatamente después.
5. Ejecuta la matriz de verificación con un `admin` y un `reporter` reales.

Importante: el repositorio actual contiene migraciones evolutivas, pero no la creación inicial de `public.trips` y `public.trip_controls`. Hasta agregar una migración base validada contra producción, una base vacía no puede reconstruirse solo con este repositorio.

## Monitoreo y diagnóstico

Revisa primero, en este orden:

1. Estado del último despliegue en Vercel.
2. **Runtime Errors** y **Runtime Logs** del entorno Production.
3. Registros de Supabase para errores de Auth, PostgREST o PostgreSQL.
4. La bitácora del viaje para confirmar qué mutación sí llegó a la base.

Los fallos de operaciones de viaje se registran en Vercel como JSON estructurado, por ejemplo con `event`, `operation` y `code`. No agregues correos, tokens, contraseñas, motivos completos ni datos del viaje a esos logs.

La aplicación incorpora la instrumentación de Vercel Web Analytics y Speed Insights; habilita ambos productos en el proyecto de Vercel para poblar sus paneles. Las URLs enviadas eliminan filtros e identificadores de viaje, y la política de referrer conserva solo el origen. Los errores de servidor se siguen revisando en Runtime Errors. El monitor automático del proyecto debe avisar solo ante errores nuevos, respuestas 5xx o despliegues fallidos, para evitar ruido por antecedentes ya resueltos.

## Copias y recuperación

- Confirma en Supabase la política de copias disponible para el plan contratado y conserva exportaciones verificadas antes de cambios de esquema importantes.
- Una copia solo cuenta como recuperable después de probar su restauración en un proyecto separado.
- Guarda por separado la configuración de Auth, URLs permitidas y variables de Vercel; no las incluyas en el repositorio.
- Para revertir únicamente el frontend, promociona en Vercel el último despliegue estable y vuelve a probar login, viajes, controles e historial.
- No reviertas una migración destructivamente en producción. Prefiere una nueva migración correctiva y valida primero una copia restaurada.
- Si se sospecha corrupción, detén las escrituras, registra la hora del incidente, conserva logs y exportaciones, y restaura en un entorno aislado antes de reemplazar producción.

## Lista corta antes de entregar

- Login válido, credenciales incorrectas y sesión vencida muestran mensajes distintos y seguros.
- `reporter` no puede escribir sobre viajes finalizados, ni desde una pestaña antigua ni llamando directamente al RPC.
- `admin` puede finalizar, reabrir y corregir con el motivo auditado.
- La bitácora muestra actor, fecha, motivo y diferencias antes/después.
- Búsqueda, paginación, exportación y diseño móvil funcionan.
- El último despliegue está `READY` y no presenta errores nuevos.
- Existe una copia o exportación reciente y se conoce el procedimiento de restauración.
