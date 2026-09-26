# Controles dinámicos, roles y auditoría

Aplica las migraciones de `supabase/migrations` en orden cronológico. Esta versión requiere, como mínimo:

1. `202609241345_dynamic_controls_and_roles.sql`
2. `202609261400_reporter_finished_trip_guard.sql`
3. `202609261500_atomic_lifecycle_and_audit.sql`

La última migración y el frontend de esta versión forman una sola entrega: crea los RPC auditados y revoca las escrituras directas que usaba la interfaz anterior. Programa una ventana breve sin escrituras, aplica la migración y publica el frontend inmediatamente después. Si el DDL encuentra un bloqueo por tráfico, la transacción completa se revierte y puede reintentarse fuera de hora pico.

## Roles

Después de crear los usuarios en Supabase Auth, asigna un rol a cada uno. Reemplaza los UUID por los valores reales de Auth:

```sql
insert into public.user_roles (user_id, role)
values
  ('UUID_DEL_ADMIN', 'admin'),
  ('UUID_DEL_REPORTERO', 'reporter')
on conflict (user_id) do update
set role = excluded.role,
    updated_at = now();
```

Obtén los UUID desde Authentication > Users o con esta consulta en el SQL Editor:

```sql
select id, email
from auth.users
order by created_at;
```

El usuario debe cerrar e iniciar sesión después de asignar o cambiar su rol.

Permisos efectivos:

- `admin`: crea viajes, finaliza y reabre viajes, y corrige su información o controles.
- `reporter`: consulta viajes y controles, y registra paradas o llegadas únicamente mientras el viaje está en ruta. La base de datos asigna la hora oficial del reporte.
- Un viaje finalizado es de solo lectura para `reporter`, incluso desde una pestaña abierta antes de la finalización.
- Corregir un viaje finalizado, reabrirlo o agregar/corregir uno de sus controles exige un motivo de hasta 2000 caracteres.
- Ningún rol de aplicación puede eliminar viajes, controles o eventos de auditoría.

La llegada final y la finalización son decisiones distintas: registrar `FINAL_ARRIVAL` no finaliza automáticamente el viaje. Un administrador valida la operación y usa “Finalizar viaje”.

## Integridad y concurrencia

Las mutaciones existentes pasan por cinco funciones de base de datos: `finish_trip`, `reopen_trip`, `update_trip_details`, `create_trip_control` y `update_trip_control`.

- Cada función vuelve a comprobar sesión y rol; no confía en que la pantalla haya ocultado un botón.
- Finalizar/reabrir y registrar controles bloquean la fila del viaje durante la transacción, por lo que finalizar compite de forma segura contra una parada enviada al mismo tiempo.
- Las correcciones comparan el `updated_at` original. Si otro administrador guardó primero, el segundo recibe un conflicto y debe recargar en lugar de sobrescribirlo.
- La fecha de finalización y la hora de reporte de un `reporter` se calculan con el reloj de PostgreSQL.
- Los timestamps se muestran e ingresan como hora Colombia (`America/Bogota`), sin depender de la zona del navegador o del servidor.
- Todo viaje nuevo debe empezar en `EN_ROUTE` y sin `finished_at`; la transición a `FINISHED` solo ocurre mediante la operación correspondiente.

## Bitácora

`trip_events` conserva actor, rol, fecha, tipo de evento, estado anterior, estado nuevo y motivo. Solo un administrador puede consultarla desde la aplicación. No se puede actualizar, borrar ni truncar desde los roles de aplicación.

La migración no inventa eventos históricos: la bitácora empieza a llenarse con las escrituras realizadas después de instalarla.

## Inventario previo

Ejecuta estas consultas antes de desplegar. Corrige cualquier fila devuelta antes de validar los `CHECK` al final.

```sql
-- Estados desconocidos o combinaciones incoherentes de estado/fecha.
select id, status, finished_at
from public.trips
where status is null
   or status::text not in ('EN_ROUTE', 'FINISHED')
   or (status::text = 'EN_ROUTE' and finished_at is not null)
   or (status::text = 'FINISHED' and finished_at is null);

-- Tipos que no son actuales ni uno de los tres horarios legados conocidos.
select id, trip_id, control_type
from public.trip_controls
where control_type is not null
  and control_type::text not in (
    'STOP', 'FINAL_ARRIVAL', '15:00', '20:00', '05:00'
  );

-- Controles cuyo viaje padre no existe.
select c.id, c.trip_id
from public.trip_controls as c
left join public.trips as t on t.id = c.trip_id
where t.id is null;
```

Cuando el inventario esté limpio, valida las restricciones instaladas como `NOT VALID`:

```sql
alter table public.trips
  validate constraint trips_status_v2_check;

alter table public.trips
  validate constraint trips_status_finished_at_v2_check;

alter table public.trip_controls
  validate constraint trip_controls_control_type_v2_check;
```

Los controles legados se conservan. Al editarlos, la interfaz obliga a escoger explícitamente si ahora corresponden a `STOP` o `FINAL_ARRIVAL`; nunca los convierte silenciosamente.

## Verificación posterior

Prueba al menos esta matriz con dos usuarios reales:

1. `reporter` agrega una parada a un viaje `EN_ROUTE`.
2. `admin` finaliza el viaje.
3. La pestaña antigua del `reporter` intenta agregar otra parada y la base la rechaza.
4. `reporter` puede consultar el viaje finalizado, pero no ve controles de edición ni la bitácora.
5. `admin` intenta corregir o reabrir sin motivo y recibe un rechazo.
6. `admin` guarda la corrección con motivo y el evento aparece en la bitácora.
7. Dos pestañas de administrador editan la misma versión; la segunda recibe un conflicto al guardar.

La prueba automática de este repositorio es contractual y estática. Ayuda a detectar que desaparezca una defensa del SQL o que el frontend vuelva a escribir tablas directamente, pero no sustituye una prueba real de PostgreSQL/RLS y concurrencia contra un proyecto Supabase temporal.
